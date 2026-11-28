import { ArtCard } from "./BrandArtPanel";

/** The frame's illustration: a teammate's note, a board card and a cursor. Not product state. */
export function SignInArtCards() {
  return (
    <>
      <ArtCard className="bottom-37.5 left-13 w-53.5 -rotate-4 bg-brand-sun-tint p-4 text-ui-md font-medium">
        Bigger photos on the landing page, and lose the carousel.
        <div className="mt-3 text-xs font-semibold text-brand-ink/75">Priya</div>
      </ArtCard>
      <ArtCard className="right-12 bottom-16 w-82.5 rotate-2">
        <div className="flex items-center gap-2 border-b border-brand-panel px-3 py-2.5 font-semibold">
          Landing page
          <span className="ms-auto rounded-full bg-brand-forest px-2 py-0.75 text-2xs font-semibold text-white">
            Live
          </span>
        </div>
        <div className="p-3.5">
          <div className="h-30 rounded-lg bg-linear-135 from-brand-cobalt to-brand-sky" />
          <div className="mt-3.5 font-brand text-xl font-semibold tracking-tight">
            Spring collection
          </div>
          <div className="mt-2.5 flex gap-2">
            <span className="h-12 flex-1 rounded-md bg-brand-panel" />
            <span className="h-12 flex-1 rounded-md bg-brand-sun-tint" />
            <span className="h-12 flex-1 rounded-md bg-brand-tint" />
          </div>
        </div>
      </ArtCard>
      <div className="absolute bottom-44 left-71.5 flex items-start gap-0.5">
        <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden>
          <path
            d="M2 2l5.5 13 2-5.5 5.5-2z"
            className="fill-brand-sun stroke-brand-ink"
            strokeWidth="1"
          />
        </svg>
        <span className="mt-3.5 rounded-full bg-brand-sun px-2.5 py-0.75 text-xs font-semibold text-brand-ink">
          Sam
        </span>
      </div>
    </>
  );
}
