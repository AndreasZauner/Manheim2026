if (!window.__ideaLabEditFocusFixInstalled) {
  window.__ideaLabEditFocusFixInstalled = true;

  const originalBlur = HTMLElement.prototype.blur;
  const originalFocus = HTMLElement.prototype.focus;

  function isIdeaLabMindmapInput(element) {
    return element?.id === 'input-box' && Boolean(element.closest?.('#ideaMindmapCanvas'));
  }

  function isInsideIdeaLabMindmap(element) {
    return Boolean(element?.closest?.('#ideaMindmapCanvas'));
  }

  function allowProgrammaticBlur() {
    window.__ideaLabAllowMindmapBlurUntil = Date.now() + 500;
  }

  function canBlurNow() {
    return Date.now() < Number(window.__ideaLabAllowMindmapBlurUntil || 0);
  }

  function activeMindmapInput() {
    return isIdeaLabMindmapInput(document.activeElement) ? document.activeElement : null;
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-idea-action="mind-save"]')) {
      allowProgrammaticBlur();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (!isIdeaLabMindmapInput(event.target)) return;
    if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') {
      allowProgrammaticBlur();
    }
  }, true);

  HTMLElement.prototype.blur = function patchedIdeaLabBlur() {
    if (isIdeaLabMindmapInput(this) && !canBlurNow()) {
      return;
    }
    return originalBlur.call(this);
  };

  HTMLElement.prototype.focus = function patchedIdeaLabFocus(...args) {
    const editing = activeMindmapInput();
    if (editing && isInsideIdeaLabMindmap(this) && this !== editing && !canBlurNow()) {
      return;
    }
    return originalFocus.apply(this, args);
  };
}
