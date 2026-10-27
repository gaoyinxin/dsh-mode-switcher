/**
 * @gaoyinxin/dsh-mode-switcher — Client Module
 * Provides a unified Plan / Build mode switcher in `conversation.input.plan`,
 * intercepts Tab in the composer to toggle modes,
 * and remembers per-mode models directly from the native model selector on the right.
 * Supports English and Simplified Chinese bilingual UI.
 */
window.__ModuleLoader__.load({
  id: '@gaoyinxin/dsh-mode-switcher',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;

    const PRESET_STORAGE_KEY = 'dsh.mode-switcher.presets.v3';

    const I18N = {
      zh: {
        btnPlanAria: '计划模式已开启，按下切换为构建模式',
        btnBuildAria: '构建模式已开启，按下切换为计划模式',
        btnPlanTitle: 'Plan 模式开启 · 点击或按 Tab 切换到 Build 模式（直接使用右侧模型选择器即可记忆当前模式模型）',
        btnBuildTitle: 'Build 模式开启 · 点击或按 Tab 切换到 Plan 模式（直接使用右侧模型选择器即可记忆当前模式模型）',
      },
      en: {
        btnPlanAria: 'Plan mode on, press to switch to Build mode',
        btnBuildAria: 'Build mode on, press to switch to Plan mode',
        btnPlanTitle: 'Plan mode on · Click or press Tab to switch to Build mode (use the model selector on the right to set this mode\'s model)',
        btnBuildTitle: 'Build mode on · Click or press Tab to switch to Plan mode (use the model selector on the right to set this mode\'s model)',
      },
    };

    function getLocale() {
      try {
        const lang = document.documentElement.lang || (typeof navigator !== 'undefined' ? navigator.language : '') || '';
        if (lang.toLowerCase().startsWith('zh')) return 'zh';
      } catch (_e) {}
      return 'en';
    }

    function useT() {
      const loc = getLocale();
      return I18N[loc] || I18N.en;
    }

    function normalizeModel(sel) {
      if (!sel || !sel.provider || !sel.model) return null;
      const out = { provider: sel.provider, model: sel.model };
      if (sel.reasoningEffort) out.reasoningEffort = sel.reasoningEffort;
      return out;
    }

    function sameModel(a, b) {
      const na = normalizeModel(a);
      const nb = normalizeModel(b);
      if (!na || !nb) return false;
      return na.provider === nb.provider &&
        na.model === nb.model &&
        (na.reasoningEffort || '') === (nb.reasoningEffort || '');
    }

    function getPresets() {
      try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            planModel: normalizeModel(parsed && parsed.planModel),
            buildModel: normalizeModel(parsed && parsed.buildModel),
          };
        }
      } catch (_err) {
        // Ignore storage read errors
      }
      return {
        planModel: null,
        buildModel: null,
      };
    }

    function savePresets(presets) {
      try {
        localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({
          planModel: normalizeModel(presets && presets.planModel),
          buildModel: normalizeModel(presets && presets.buildModel),
        }));
      } catch (_err) {
        // Ignore storage write errors
      }
    }

    const sessionTrackers = new Map();

    function getTracker(sessionId) {
      let tracker = sessionTrackers.get(sessionId);
      if (!tracker) {
        tracker = {
          lastMode: null,
          lastSelection: null,
          switchingInFlight: false,
          pendingTargetModel: null,
        };
        sessionTrackers.set(sessionId, tracker);
      }
      return tracker;
    }

    async function selectSessionModel(ctx, sessionId, targetModel) {
      const norm = normalizeModel(targetModel);
      if (!norm || !sessionId || !ctx.remote || !ctx.remote.session || !ctx.remote.session.selectModel) return;
      const req = {
        sessionId: sessionId,
        provider: norm.provider,
        model: norm.model,
      };
      if (norm.reasoningEffort) req.reasoningEffort = norm.reasoningEffort;
      await ctx.remote.session.selectModel(req);
    }

    async function doToggleMode(ctx, sessionId, currentPlan, currentSelection) {
      if (!sessionId) return false;
      const tracker = getTracker(sessionId);
      const targetPlan = !currentPlan;
      const command = targetPlan ? '/plan' : '/plan off';

      const presets = getPresets();
      const currentNorm = normalizeModel(currentSelection);
      if (currentNorm && !tracker.pendingTargetModel) {
        if (currentPlan) presets.planModel = currentNorm;
        else presets.buildModel = currentNorm;
        savePresets(presets);
      }

      const targetModel = normalizeModel(targetPlan ? presets.planModel : presets.buildModel) || currentNorm;
      if (targetModel) {
        if (targetPlan && !presets.planModel) {
          presets.planModel = targetModel;
          savePresets(presets);
        } else if (!targetPlan && !presets.buildModel) {
          presets.buildModel = targetModel;
          savePresets(presets);
        }
      }

      tracker.switchingInFlight = true;
      tracker.lastMode = targetPlan;
      tracker.pendingTargetModel = (targetModel && !sameModel(targetModel, currentNorm)) ? targetModel : null;

      try {
        if (ctx.remote && ctx.remote.commands) {
          const res = await ctx.remote.commands.execute(sessionId, command, []);
          if (!res.ok) {
            tracker.lastMode = currentPlan;
            tracker.pendingTargetModel = null;
            return false;
          }
        }

        if (targetModel && !sameModel(targetModel, currentNorm)) {
          await selectSessionModel(ctx, sessionId, targetModel);
          tracker.lastSelection = targetModel;
        }
        return true;
      } catch (_err) {
        tracker.pendingTargetModel = null;
        return true;
      } finally {
        tracker.switchingInFlight = false;
      }
    }

    const globalState = {
      sessionId: null,
      isPlan: false,
      locked: false,
      toggle: null,
      currentSelection: null,
    };

    function ModeSwitcherControl(props) {
      const { sessionId, locked, useProjection, toggleMode, applyModel } = props;
      const plan = useProjection ? useProjection('plan') : undefined;
      const modelSel = useProjection ? useProjection('modelSelection') : undefined;
      const target = plan ? (plan.pending ? !plan.active : plan.active) : false;
      const currentSelection = (modelSel && (modelSel.next || modelSel.lastUsed)) || null;
      const t = useT();

      const [busy, setBusy] = useState(false);
      const isDisabled = Boolean(locked || busy);

      useEffect(() => {
        globalState.sessionId = sessionId;
        globalState.isPlan = target;
        globalState.locked = Boolean(locked);
        globalState.toggle = toggleMode;
        globalState.currentSelection = currentSelection;
      }, [sessionId, target, locked, toggleMode, currentSelection]);

      useEffect(() => {
        if (!sessionId) return;
        const tracker = getTracker(sessionId);
        const currentNorm = normalizeModel(currentSelection);

        // First render for this session: record initial mode
        if (tracker.lastMode === null) {
          tracker.lastMode = target;
        }

        // Case 1: Mode changed externally (e.g. via /plan command or Approve on plan review card)
        if (tracker.lastMode !== target) {
          tracker.lastMode = target;
          if (!tracker.switchingInFlight) {
            const presets = getPresets();
            const savedModel = normalizeModel(target ? presets.planModel : presets.buildModel);
            if (savedModel && !sameModel(savedModel, currentNorm)) {
              tracker.pendingTargetModel = savedModel;
              if (applyModel) {
                applyModel(savedModel)
                  .then(() => { tracker.lastSelection = savedModel; })
                  .catch(() => { tracker.pendingTargetModel = null; });
              }
            } else if (!savedModel && currentNorm) {
              presets[target ? 'planModel' : 'buildModel'] = currentNorm;
              savePresets(presets);
            }
          }
          return;
        }

        // Case 2: Mode did NOT change; check if currentSelection loaded or was changed by the user
        if (!currentNorm) return;

        if (tracker.pendingTargetModel) {
          if (sameModel(currentNorm, tracker.pendingTargetModel)) {
            tracker.pendingTargetModel = null;
            tracker.lastSelection = currentNorm;
          }
          return;
        }

        if (tracker.switchingInFlight) return;

        // Initial modelSelection projection load for this session: seed preset only if empty
        if (tracker.lastSelection === null) {
          tracker.lastSelection = currentNorm;
          const presets = getPresets();
          const key = target ? 'planModel' : 'buildModel';
          if (!presets[key]) {
            presets[key] = currentNorm;
            savePresets(presets);
          }
          return;
        }

        // User manually changed the model via the native right-side model selector
        if (!sameModel(currentNorm, tracker.lastSelection)) {
          tracker.lastSelection = currentNorm;
          const presets = getPresets();
          const key = target ? 'planModel' : 'buildModel';
          if (!sameModel(presets[key], currentNorm)) {
            presets[key] = currentNorm;
            savePresets(presets);
          }
        }
      }, [sessionId, target, currentSelection, applyModel]);

      const onButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabled || !toggleMode) return;
        setBusy(true);
        toggleMode(target, currentSelection)
          .catch(() => {})
          .finally(() => { setBusy(false); });
      };

      const buttonStyle = target ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '28px',
        padding: '0 8px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        background: 'var(--dsw-alias-state-business-tertiary, #e6f4ff)',
        color: 'var(--dsw-alias-state-business-primary, #1677ff)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
      } : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '28px',
        padding: '0 8px',
        border: '1px solid var(--dsw-alias-border-subtle, #d9d9d9)',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, #595959)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
      };

      const hintStyle = {
        fontSize: '10px',
        opacity: 0.75,
        padding: '1px 4px',
        borderRadius: '3px',
        background: target ? 'rgba(22, 119, 255, 0.15)' : 'rgba(128, 128, 128, 0.15)',
        lineHeight: 1,
        marginLeft: '2px',
      };

      return h('button', {
        type: 'button',
        style: buttonStyle,
        disabled: isDisabled,
        onClick: onButtonClick,
        'aria-label': target ? t.btnPlanAria : t.btnBuildAria,
        title: target ? t.btnPlanTitle : t.btnBuildTitle,
      }, [
        h('span', { style: { fontSize: '13px', display: 'inline-flex' }, 'aria-hidden': 'true' }, target ? '📋' : '🛠️'),
        h('span', null, target ? 'Plan' : 'Build'),
        h('span', { style: hintStyle, 'aria-hidden': 'true' }, '⇥ Tab'),
      ]);
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'remote.session'],
      apply(ctx) {
        ctx.effect(() => {
          const onKeyDown = (e) => {
            if (e.key !== 'Tab' || globalState.locked) return;

            const activeEl = document.activeElement;
            if (!activeEl) return;

            const isComposer = (
              activeEl.getAttribute('contenteditable') === 'true' ||
              activeEl.getAttribute('data-composer-input') !== null ||
              activeEl.closest('[data-composer-card]') !== null ||
              activeEl.closest('[data-input-scroll]') !== null
            );
            if (!isComposer) return;

            const menuOpen = document.querySelector('[data-composer-overlay] [role="listbox"]') !== null ||
                             document.querySelector('[role="listbox"]') !== null;
            if (menuOpen) return;

            e.preventDefault();
            e.stopPropagation();

            if (globalState.toggle) {
              globalState.toggle(globalState.isPlan, globalState.currentSelection).catch(() => {});
            }
          };

          window.addEventListener('keydown', onKeyDown, true);
          return () => {
            window.removeEventListener('keydown', onKeyDown, true);
          };
        }, 'mode-switcher: tab keyboard listener');

        ctx.slots.inject('conversation.input.plan', () => ctx.slots.register({
          name: 'conversation.input.plan',
          priority: -10,
          inject: (sessionId) => ({
            sessionId,
            toggleMode: (currentPlan, currentSelection) => doToggleMode(ctx, sessionId, currentPlan, currentSelection),
            applyModel: (targetModel) => selectSessionModel(ctx, sessionId, targetModel),
          }),
        }, ModeSwitcherControl));
      },
    };
  },
});
