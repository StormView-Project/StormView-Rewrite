/*
 * LibreWXR radar tile kernels, compiled to WebAssembly (wasm32, no libc).
 *
 * The worker (radarWorker.js) fetches raw reflectivity tiles (color scheme 255,
 * no smoothing) and inflates them with the browser's native DecompressionStream.
 * Everything per-pixel after that runs here:
 *
 *   png_unfilter    reverse PNG scanline filters
 *   png_to_values   scanlines -> one raw value byte per pixel (dBZ = v/2 - 32)
 *   estimate_block  how many tile pixels one source radar pixel spans
 *   build_padded    stitch a tile + its 8 neighbours into a padded grid
 *   render_tile     LUT colorize + Gaussian blur + crop to the tile
 *
 * render_tile mirrors LibreWXR's own presentation step (colorize, then Pillow's
 * GaussianBlur on the RGBA result), so on-device tiles match the server's look.
 *
 * Rebuild with `npm run build:wasm` (see scripts/build-radar-wasm.sh).
 */
#include <stdint.h>
#include <wasm_simd128.h>

typedef uint8_t  u8;
typedef uint32_t u32;

#define EXPORT(name) __attribute__((export_name(name)))

/* ---------------------------------------------------------------- PNG decode */

static inline int paeth(int a, int b, int c) {
  int p  = a + b - c;
  int pa = p > a ? p - a : a - p;
  int pb = p > b ? p - b : b - p;
  int pc = p > c ? p - c : c - p;
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/*
 * data: `h` rows of (1 filter byte + stride) as inflated from IDAT.
 * out:  h * stride unfiltered bytes.  bpp: bytes per pixel, minimum 1.
 * Returns 0, or -1 on an unknown filter type.
 */
EXPORT("png_unfilter")
int png_unfilter(const u8 *data, u8 *out, int stride, int h, int bpp) {
  for (int y = 0; y < h; y++) {
    const u8 *src  = data + y * (stride + 1);
    const u8 *s    = src + 1;
    u8 *row        = out + y * stride;
    const u8 *prev = y ? row - stride : 0;
    int i;

    switch (src[0]) {
      case 0:
        for (i = 0; i < stride; i++) row[i] = s[i];
        break;
      case 1:
        for (i = 0; i < bpp && i < stride; i++) row[i] = s[i];
        for (; i < stride; i++) row[i] = s[i] + row[i - bpp];
        break;
      case 2:
        if (prev) for (i = 0; i < stride; i++) row[i] = s[i] + prev[i];
        else      for (i = 0; i < stride; i++) row[i] = s[i];
        break;
      case 3:
        for (i = 0; i < stride; i++) {
          int left = i >= bpp ? row[i - bpp] : 0;
          int up   = prev ? prev[i] : 0;
          row[i] = s[i] + ((left + up) >> 1);
        }
        break;
      case 4:
        for (i = 0; i < stride; i++) {
          int left = i >= bpp ? row[i - bpp] : 0;
          int up   = prev ? prev[i] : 0;
          int ul   = (prev && i >= bpp) ? prev[i - bpp] : 0;
          row[i] = s[i] + paeth(left, up, ul);
        }
        break;
      default:
        return -1;
    }
  }
  return 0;
}

/*
 * Unfiltered scanlines -> raw value per pixel.
 *   color_type 0 / 3 (gray / palette, 1-8 bit): value = map[sample]
 *   color_type 2 (RGB 8-bit):                   value = R
 *   color_type 4 (gray+alpha 8-bit):            value = alpha ? gray : 0
 *   color_type 6 (RGBA 8-bit):                  value = alpha ? R : 0
 * `map` is a 256-byte table built by the caller from PLTE/tRNS.
 * Returns the number of non-zero pixels (0 = fully transparent tile).
 */
EXPORT("png_to_values")
int png_to_values(const u8 *scan, u8 *out, int w, int h, int stride,
                  int color_type, int bit_depth, const u8 *map) {
  int nonzero = 0;
  for (int y = 0; y < h; y++) {
    const u8 *row = scan + y * stride;
    u8 *o = out + y * w;
    if (color_type == 0 || color_type == 3) {
      if (bit_depth == 8) {
        for (int x = 0; x < w; x++) o[x] = map[row[x]];
      } else {
        int per_byte = 8 / bit_depth, mask = (1 << bit_depth) - 1;
        for (int x = 0; x < w; x++) {
          int shift = 8 - bit_depth * (x % per_byte + 1);
          o[x] = map[(row[x / per_byte] >> shift) & mask];
        }
      }
    } else if (color_type == 2) {
      for (int x = 0; x < w; x++) o[x] = row[x * 3];
    } else if (color_type == 4) {
      for (int x = 0; x < w; x++) o[x] = row[x * 2 + 1] ? row[x * 2] : 0;
    } else {
      for (int x = 0; x < w; x++) o[x] = row[x * 4 + 3] ? row[x * 4] : 0;
    }
    for (int x = 0; x < w; x++) nonzero += o[x] != 0;
  }
  return nonzero;
}

/* ------------------------------------------------------------ Block estimate */

/*
 * Raw tiles are nearest-neighbour samples of the source radar grid, so at high
 * zoom each source pixel shows up as a block of identical values.  The most
 * common length of an interior horizontal run (bounded on both sides by
 * different non-zero values) is that block size -- the same "tile pixels per
 * region pixel" ratio LibreWXR's compute_blur_radius() reads from its grid.
 * Returns 0 when the tile has too few interior runs to tell.
 */
EXPORT("estimate_block")
int estimate_block(const u8 *v, int w, int h) {
  u32 hist[65];
  for (int i = 0; i < 65; i++) hist[i] = 0;
  u32 total = 0;

  for (int y = 0; y < h; y++) {
    const u8 *row = v + y * w;
    int x = 0;
    while (x < w) {
      u8 val = row[x];
      int start = x;
      while (x < w && row[x] == val) x++;
      int len = x - start;
      if (val && start > 0 && x < w && row[start - 1] && row[x] && len <= 64) {
        hist[len]++;
        total++;
      }
    }
  }
  if (total < 64) return 0;

  int best = 1;
  for (int i = 2; i <= 64; i++) if (hist[i] > hist[best]) best = i;
  return best;
}

/* ------------------------------------------------------------- Padded stitch */

/*
 * Build a (w + 2*pad)^2 value grid centred on `tiles[4]`.  tiles[0..8] are the
 * 3x3 neighbourhood in row-major order (tiles[4] = centre).  A null neighbour
 * is unknown (not loaded): its area replicates the centre tile's nearest edge,
 * the same clamp a blur would apply at an image border.  Known-empty
 * neighbours should be passed as a pointer to zeros, not null.
 */
EXPORT("build_padded")
void build_padded(const u8 *const *tiles, int w, int pad, u8 *out) {
  int pw = w + 2 * pad;
  const u8 *centre = tiles[4];

  for (int py = 0; py < pw; py++) {
    int ty = py - pad;
    int ny = ty < 0 ? 0 : (ty >= w ? 2 : 1);
    int ly = ty < 0 ? ty + w : (ty >= w ? ty - w : ty);
    int cy = ty < 0 ? 0 : (ty >= w ? w - 1 : ty);
    u8 *o = out + py * pw;

    for (int px = 0; px < pw; px++) {
      int tx = px - pad;
      int nx = tx < 0 ? 0 : (tx >= w ? 2 : 1);
      const u8 *t = tiles[ny * 3 + nx];
      if (t) {
        int lx = tx < 0 ? tx + w : (tx >= w ? tx - w : tx);
        o[px] = t[ly * w + lx];
      } else {
        int cx = tx < 0 ? 0 : (tx >= w ? w - 1 : tx);
        o[px] = centre[cy * w + cx];
      }
    }
  }
}

/* ------------------------------------------------------- Colorize + blur */

/*
 * Pillow's _gaussian_blur_radius(): the extended-box radius whose `passes`
 * repeated box blurs approximate a Gaussian of standard deviation `sigma`
 * (Gwosdek et al., "Theoretical foundations of Gaussian convolution by
 * extended box filtering").
 */
static float extended_box_radius(float sigma, int passes) {
  float sigma2 = sigma * sigma / passes;
  float L = __builtin_sqrtf(12.0f * sigma2 + 1.0f);
  float l = __builtin_floorf((L - 1.0f) / 2.0f);
  float a = (2 * l + 1) * (l * (l + 1) - 3 * sigma2);
  a /= 6 * (sigma2 - (l + 1) * (l + 1));
  return l + a;
}

static inline v128_t load_px(const u32 *p) {
  /* one RGBA pixel -> four u32 lanes */
  return wasm_u32x4_extend_low_u16x8(wasm_u16x8_extend_low_u8x16(wasm_v128_load32_zero(p)));
}

static inline u32 store_px(v128_t v) {
  v128_t h = wasm_u16x8_narrow_i32x4(v, v);
  v128_t b = wasm_u8x16_narrow_i16x8(h, h);
  return (u32)wasm_i32x4_extract_lane(b, 0);
}

/*
 * One extended-box pass over each row of a w*h RGBA image (Pillow's
 * ImagingLineBoxBlur32): a window of 2r+1 full-weight pixels plus the two
 * pixels just outside it at fractional weight, edges clamped.  All four
 * channels ride in one SIMD vector.
 */
static void box_blur_rows(const u32 *in, u32 *out, int w, int h, float radius) {
  int r = (int)radius;
  u32 ww = (u32)((1 << 24) / (radius * 2 + 1));
  u32 fw = ((1 << 24) - (u32)(r * 2 + 1) * ww) / 2;
  v128_t vww  = wasm_i32x4_splat((int)ww);
  v128_t vfw  = wasm_i32x4_splat((int)fw);
  v128_t half = wasm_i32x4_splat(1 << 23);
  int last = w - 1;

  for (int y = 0; y < h; y++) {
    const u32 *line = in + y * w;
    u32 *o = out + y * w;

    v128_t acc = wasm_i32x4_splat(0);
    for (int k = -r; k <= r; k++) {
      int i = k < 0 ? 0 : (k > last ? last : k);
      acc = wasm_i32x4_add(acc, load_px(line + i));
    }

    for (int x = 0; x < w; x++) {
      int lo = x - r - 1, hi = x + r + 1;
      v128_t a = load_px(line + (lo < 0 ? 0 : lo));
      v128_t b = load_px(line + (hi > last ? last : hi));
      v128_t bulk = wasm_i32x4_add(wasm_i32x4_mul(acc, vww),
                                   wasm_i32x4_mul(wasm_i32x4_add(a, b), vfw));
      o[x] = store_px(wasm_u32x4_shr(wasm_i32x4_add(bulk, half), 24));

      /* slide: add the pixel entering on the right, drop the one leaving */
      int out_i = x - r;
      acc = wasm_i32x4_add(acc, b);
      acc = wasm_i32x4_sub(acc, load_px(line + (out_i < 0 ? 0 : out_i)));
    }
  }
}

static void transpose(const u32 *in, u32 *out, int w, int h) {
  /* 32x32 blocks keep both sides cache-friendly */
  for (int by = 0; by < h; by += 32)
    for (int bx = 0; bx < w; bx += 32) {
      int ey = by + 32 < h ? by + 32 : h, ex = bx + 32 < w ? bx + 32 : w;
      for (int y = by; y < ey; y++)
        for (int x = bx; x < ex; x++) out[x * h + y] = in[y * w + x];
    }
}

/*
 * Colorize a padded pw*pw value grid through `lut` (256 RGBA entries),
 * Gaussian-blur it the way Pillow's GaussianBlur(radius) does (3 extended-box
 * passes each way, all four channels independently), then crop the centre
 * (pw - 2*pad)^2 into `out`.  buf_a / buf_b are pw*pw scratch images.
 * A radius below 0.5 skips the blur, as LibreWXR does.
 */
EXPORT("render_tile")
void render_tile(const u8 *vals, int pw, int pad, const u32 *lut, float radius,
                 u32 *out, u32 *buf_a, u32 *buf_b) {
  int n = pw * pw;
  for (int i = 0; i < n; i++) buf_a[i] = lut[vals[i]];

  if (radius >= 0.5f) {
    float box = extended_box_radius(radius, 3);
    box_blur_rows(buf_a, buf_b, pw, pw, box);
    box_blur_rows(buf_b, buf_a, pw, pw, box);
    box_blur_rows(buf_a, buf_b, pw, pw, box);
    transpose(buf_b, buf_a, pw, pw);
    box_blur_rows(buf_a, buf_b, pw, pw, box);
    box_blur_rows(buf_b, buf_a, pw, pw, box);
    box_blur_rows(buf_a, buf_b, pw, pw, box);
    transpose(buf_b, buf_a, pw, pw);
  }

  int w = pw - 2 * pad;
  for (int y = 0; y < w; y++) {
    const u32 *src = buf_a + (y + pad) * pw + pad;
    u32 *dst = out + y * w;
    for (int x = 0; x < w; x++) dst[x] = src[x];
  }
}
