// Overlay/menu screens (start, Lance Hub, contract briefing, game over) must always fit the
// current viewport with zero scrollbars, at any resolution or Chrome window size - not just a
// specific reference resolution. The gameplay canvas already adapts to the viewport on its own
// (see core/runtime.js resize()); this only covers the DOM menu screens layered over it.
//
// Approach: measure each screen's real, unscaled content box (.fit-scale) and uniformly shrink
// it with transform:scale() to fit inside the screen's available area, instead of guessing a
// breakpoint or letting it overflow into a scrollbar. A ResizeObserver on the content element
// means this reacts both to window resizes and to the content itself changing size (e.g. the
// tactical shop growing as upgrades are purchased) with no per-render call-site wiring needed.

const FIT_MARGIN = 0.96; // small breathing room so scaled content never touches the screen edge

export function fitScaleToViewport(screenEl, contentEl) {
    if (!screenEl || !contentEl) return;

    const apply = () => {
        contentEl.style.transform = 'none';
        const contentW = contentEl.offsetWidth;
        const contentH = contentEl.offsetHeight;
        if (!contentW || !contentH) return; // screen is currently hidden (display:none) - nothing to fit yet
        const availW = screenEl.clientWidth * FIT_MARGIN;
        const availH = screenEl.clientHeight * FIT_MARGIN;
        const scale = Math.min(1, availW / contentW, availH / contentH);
        contentEl.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    };

    // Deferred to the next frame instead of run straight from the observer/resize callback - a
    // style mutation applied synchronously inside a ResizeObserver callback can get re-observed
    // within the same delivery cycle, which is what triggers Chrome's benign-but-loud "ResizeObserver
    // loop completed with undelivered notifications" diagnostic.
    let scheduled = false;
    const scheduleApply = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; apply(); });
    };

    new ResizeObserver(scheduleApply).observe(contentEl);
    window.addEventListener('resize', scheduleApply);
    apply();
}
