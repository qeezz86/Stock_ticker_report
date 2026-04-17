export function getRuntimeStatus(env = process.env) {
  const dartReady = Boolean(env.DART_API_KEY);
  const krxReady = Boolean(env.KRX_API_KEY);
  const mode = dartReady ? (krxReady ? "live" : "partial") : "offline";

  return {
    mode,
    sources: {
      dart: { ready: dartReady },
      krx: { ready: krxReady }
    }
  };
}
