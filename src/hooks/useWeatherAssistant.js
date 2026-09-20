import { useCallback, useEffect, useRef, useState } from 'react';
import { getEngine, resetEngine, buildSystemPrompt, checkWebGPU } from '../services/webllm';
import useAppStore from '../store/useAppStore';

const STALL_TIMEOUT_MS = 30000;
// How many recent chat messages to resend as context. Keeps the prompt inside
// the small model's context window (gemma3-1b is capped at 4096 tokens) and,
// just as importantly, keeps old questions from crowding out the current one —
// a weak model given a long history can drift into answering a previous
// question instead of the new one.
const MAX_HISTORY_MESSAGES = 8;

const GPU_REASON_MESSAGES = {
  missing: 'Your browser doesn\'t expose the WebGPU API at all. Try a recent Chrome, Edge, or Firefox.',
  'no-adapter': 'WebGPU is present but no GPU adapter was found — hardware acceleration may be off, or the GPU is driver-blocklisted.',
  timeout: 'The browser never responded about GPU availability. WebGPU is likely disabled, or the GPU driver is misbehaving — on Linux this often needs a working Vulkan driver and hardware acceleration enabled.',
  error: 'Checking for WebGPU support threw an error.',
};

/**
 * Owns the WebLLM engine lifecycle and chat state for the floating weather
 * assistant. `weatherData` is passed in from `useWeather()` (already fetched
 * by the app) — no separate fetch happens here.
 */
export function useWeatherAssistant(weatherData) {
  const units = useAppStore((s) => s.units);
  const location = useAppStore((s) => s.location);
  const assistantModel = useAppStore((s) => s.assistantModel);

  // checking | idle | loading | ready | error | unsupported
  const [status, setStatus] = useState('checking');
  const [progress, setProgress] = useState(null); // { progress: 0-1, text }
  const [errorMsg, setErrorMsg] = useState(null);
  const [gpuReason, setGpuReason] = useState(null);
  const [messages, setMessages] = useState([]); // [{ role: 'user'|'assistant', content }]
  const [streaming, setStreaming] = useState(false);
  const engineRef = useRef(null);
  const loadedModelRef = useRef(null);

  // WebGPU must actually be probed (requestAdapter), not just checked for
  // existence — `navigator.gpu` can exist while no adapter is obtainable.
  // Running it up front (and disallowing `load()` until it passes) means the
  // model can never even start loading when WebGPU isn't really usable.
  const recheckGpu = useCallback(async () => {
    setStatus('checking');
    setGpuReason(null);
    const { supported, reason } = await checkWebGPU();
    setStatus(supported ? 'idle' : 'unsupported');
    if (!supported) setGpuReason(reason);
  }, []);

  useEffect(() => {
    recheckGpu();
  }, [recheckGpu]);

  const load = useCallback(async () => {
    if (status === 'loading' || status === 'checking' || status === 'unsupported') return;
    if (status === 'ready' && loadedModelRef.current === assistantModel) return;
    setStatus('loading');
    setErrorMsg(null);
    setProgress(null);

    // WebLLM gives no way to cancel an in-flight load, and a stuck network
    // request or a WebGPU adapter that never resolves (common on Linux with
    // an unconfigured GPU driver) otherwise hangs the UI forever with no
    // feedback. Bail out — and let the user retry — if we go too long
    // without any progress at all.
    let settled = false;
    let stallTimer;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resetEngine();
        setErrorMsg(
          'Loading stalled with no progress for 30 seconds. This usually means a browser extension ' +
          'or firewall is blocking the model download (huggingface.co), or WebGPU can\'t get a GPU ' +
          'adapter on this machine — on Linux that often needs a Vulkan driver / chrome://flags ' +
          'checked. Check the browser console/network tab for the actual error.'
        );
        setStatus('error');
      }, STALL_TIMEOUT_MS);
    };

    try {
      armStallTimer();
      const engine = await getEngine(assistantModel, (report) => {
        if (settled) return;
        armStallTimer();
        setProgress({ progress: report.progress, text: report.text });
      });
      clearTimeout(stallTimer);
      if (settled) return; // already timed out and moved to the error state
      settled = true;
      engineRef.current = engine;
      loadedModelRef.current = assistantModel;
      setStatus('ready');
    } catch (err) {
      clearTimeout(stallTimer);
      if (settled) return;
      settled = true;
      // Otherwise the rejected promise stays cached at module scope and
      // "Try Again" would just replay the same stale failure forever.
      resetEngine();
      setErrorMsg(err?.message ?? 'Failed to load the assistant model.');
      setStatus('error');
    }
  }, [assistantModel, status]);

  const sendMessage = useCallback(async (text) => {
    const engine = engineRef.current;
    if (!engine || !text.trim() || streaming) return;

    const userMsg = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const chatMessages = [
        { role: 'system', content: buildSystemPrompt(weatherData, units, location) },
        ...nextMessages.slice(-MAX_HISTORY_MESSAGES),
      ];
      const stream = await engine.chat.completions.create({
        messages: chatMessages,
        stream: true,
      });

      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (!delta) continue;
        full += delta;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: 'assistant', content: full };
          return copy;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err?.message ?? 'something went wrong.'}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, weatherData, units, location]);

  const reset = useCallback(() => setMessages([]), []);

  const gpuMessage = gpuReason ? GPU_REASON_MESSAGES[gpuReason] ?? GPU_REASON_MESSAGES.error : null;

  return {
    status, progress, errorMsg, messages, streaming,
    gpuMessage, recheckGpu,
    load, sendMessage, reset,
  };
}
