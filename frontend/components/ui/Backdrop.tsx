export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob left-[-10%] top-[-20%] h-[55vw] w-[55vw] bg-violet-600" />
      <div className="aurora-blob right-[-15%] top-[10%] h-[45vw] w-[45vw] bg-cyan-500 [animation-delay:-6s]" />
      <div className="aurora-blob bottom-[-25%] left-[20%] h-[50vw] w-[50vw] bg-fuchsia-600 opacity-25 [animation-delay:-12s]" />
      <div className="grid-bg absolute inset-0" />
      <div className="noise absolute inset-0" />
    </div>
  );
}
