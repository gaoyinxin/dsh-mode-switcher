/**
 * @gaoyinxin/dsh-mode-switcher — Client Module
 * Provides a unified Plan / Build mode switcher in `conversation.input.plan`,
 * intercepts Tab in the composer to toggle modes,
 * and defaults to the user's current model/provider unless customized in settings.
 */
window.__ModuleLoader__.load({
  id: '@gaoyinxin/dsh-mode-switcher',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;

    const PRESET_STORAGE_KEY = 'dsh.mode-switcher.presets.v2';

    function getPresets() {
      try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
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
        localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      } catch (_err) {
        // Ignore storage write errors
      }
    }

    async function doToggleMode(ctx, sessionId, currentPlan, currentSelection) {
      if (!sessionId) return false;
      const targetPlan = !currentPlan;
      const command = targetPlan ? '/plan' : '/plan off';

      if (ctx.remote && ctx.remote.commands) {
        const res = await ctx.remote.commands.execute(sessionId, command, []);
        if (!res.ok) return false;
      }

      try {
        const presets = getPresets();
        const preset = targetPlan ? presets.planModel : presets.buildModel;
        if (preset && preset.provider && preset.model) {
          const isAlreadySelected = currentSelection &&
            currentSelection.provider === preset.provider &&
            currentSelection.model === preset.model;
          if (!isAlreadySelected && ctx.remote && ctx.remote.session && ctx.remote.session.selectModel) {
            await ctx.remote.session.selectModel({
              sessionId: sessionId,
              provider: preset.provider,
              model: preset.model,
              reasoningEffort: preset.reasoningEffort,
            });
          }
        }
      } catch (_err) {
        // Model selection failure does not roll back mode toggle
      }
      return true;
    }

    const globalState = {
      sessionId: null,
      isPlan: false,
      locked: false,
      toggle: null,
      currentSelection: null,
    };

    function ModeSettingsModal(props) {
      const { onClose, catalogGroups, currentSelection, catalogDefault } = props;
      const [presets, setPresets] = useState(getPresets());

      useEffect(() => {
        const onEsc = (e) => {
          if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onEsc);
        return () => window.removeEventListener('keydown', onEsc);
      }, [onClose]);

      const allModels = [];
      if (catalogGroups) {
        for (const group of catalogGroups) {
          for (const model of group.models) {
            allModels.push({
              provider: group.id,
              providerName: group.name,
              model: model.id,
              modelName: model.name,
            });
          }
        }
      }

      const currentTarget = currentSelection || catalogDefault;
      const matched = currentTarget
        ? allModels.find(m => m.provider === currentTarget.provider && m.model === currentTarget.model)
        : null;
      const currentDisplay = matched
        ? `${matched.modelName} (${matched.providerName})`
        : (currentTarget ? `${currentTarget.model} (${currentTarget.provider})` : '默认');

      const save = (newPresets) => {
        setPresets(newPresets);
        savePresets(newPresets);
      };

      const fieldStyle = {
        width: '100%',
        padding: '7px 10px',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        border: '1px solid var(--dsw-alias-border-default, #d9d9d9)',
        background: 'var(--dsw-alias-bg-surface, transparent)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontSize: '13px',
        outline: 'none',
      };

      return h('div', {
        role: 'dialog',
        'aria-modal': 'true',
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        },
        onClick: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
      }, [
        h('div', {
          style: {
            background: 'var(--dsw-alias-bg-floating, #ffffff)',
            color: 'var(--dsw-alias-label-primary, #1a1a1a)',
            border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.2))',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
            minWidth: '380px',
            maxWidth: '460px',
            fontFamily: 'inherit',
          },
        }, [
          h('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            },
          }, [
            h('span', { style: { fontWeight: 600, fontSize: '15px' } }, '模式预设模型设置'),
            h('button', {
              type: 'button',
              onClick: onClose,
              'aria-label': '关闭',
              style: {
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                color: 'var(--dsw-alias-label-secondary, #666)',
              },
            }, '✕'),
          ]),
          h('div', { style: { marginBottom: '14px' } }, [
            h('label', {
              style: { display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--dsw-alias-label-secondary, #595959)' },
            }, '📋 Plan 模式模型'),
            h('select', {
              value: presets.planModel ? `${presets.planModel.provider}/${presets.planModel.model}` : '',
              onChange: (e) => {
                const val = e.target.value;
                if (!val) {
                  save({ ...presets, planModel: null });
                } else {
                  const parts = val.split('/');
                  save({ ...presets, planModel: { provider: parts[0], model: parts.slice(1).join('/') } });
                }
              },
              style: fieldStyle,
            }, [
              h('option', { key: '__default', value: '' }, `跟随当前模型 (当前: ${currentDisplay})`),
              ...allModels.map(m => h('option', { key: `${m.provider}/${m.model}`, value: `${m.provider}/${m.model}` }, `${m.modelName} (${m.providerName})`)),
            ]),
          ]),
          h('div', { style: { marginBottom: '18px' } }, [
            h('label', {
              style: { display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--dsw-alias-label-secondary, #595959)' },
            }, '🛠️ Build 模式模型'),
            h('select', {
              value: presets.buildModel ? `${presets.buildModel.provider}/${presets.buildModel.model}` : '',
              onChange: (e) => {
                const val = e.target.value;
                if (!val) {
                  save({ ...presets, buildModel: null });
                } else {
                  const parts = val.split('/');
                  save({ ...presets, buildModel: { provider: parts[0], model: parts.slice(1).join('/') } });
                }
              },
              style: fieldStyle,
            }, [
              h('option', { key: '__default', value: '' }, `跟随当前模型 (当前: ${currentDisplay})`),
              ...allModels.map(m => h('option', { key: `${m.provider}/${m.model}`, value: `${m.provider}/${m.model}` }, `${m.modelName} (${m.providerName})`)),
            ]),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, [
            h('button', {
              type: 'button',
              onClick: onClose,
              style: {
                padding: '6px 16px',
                background: 'var(--dsw-alias-state-business-primary, #1677ff)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--dsw-radius-sm, 6px)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              },
            }, '完成'),
          ]),
        ]),
      ]);
    }

    function ModeSwitcherControl(props) {
      const { sessionId, locked, useProjection, toggleMode, getCatalog } = props;
      const plan = useProjection ? useProjection('plan') : undefined;
      const modelSel = useProjection ? useProjection('modelSelection') : undefined;
      const target = plan ? (plan.pending ? !plan.active : plan.active) : false;
      const currentSelection = (modelSel && (modelSel.next || modelSel.lastUsed)) || null;

      const [busy, setBusy] = useState(false);
      const [showSettings, setShowSettings] = useState(false);
      const [catalogGroups, setCatalogGroups] = useState(null);
      const [catalogDefault, setCatalogDefault] = useState(null);

      const isDisabled = Boolean(locked || busy);

      useEffect(() => {
        globalState.sessionId = sessionId;
        globalState.isPlan = target;
        globalState.locked = Boolean(locked);
        globalState.toggle = toggleMode;
        globalState.currentSelection = currentSelection;
      }, [sessionId, target, locked, toggleMode, currentSelection]);

      const onButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabled || !toggleMode) return;
        setBusy(true);
        toggleMode(target, currentSelection)
          .catch(() => {})
          .finally(() => { setBusy(false); });
      };

      const openSettings = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (getCatalog) {
          const catP = getCatalog();
          if (catP && typeof catP.then === 'function') {
            catP.then((res) => {
              if (res && res.ok && res.value) {
                setCatalogGroups(res.value.groups);
                if (res.value.default) setCatalogDefault(res.value.default);
              }
            }).catch(() => {});
          }
        }
        setShowSettings(true);
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

      return h('div', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '3px' },
      }, [
        h('button', {
          type: 'button',
          style: buttonStyle,
          disabled: isDisabled,
          onClick: onButtonClick,
          'aria-label': target
            ? 'Plan mode on, press to turn off'
            : 'Build mode on, press to switch to plan mode',
          title: target
            ? 'Plan 模式开启 · 点击或按 Tab 切换到 Build 模式'
            : 'Build 模式开启 · 点击或按 Tab 切换到 Plan 模式',
        }, [
          h('span', { style: { fontSize: '13px', display: 'inline-flex' }, 'aria-hidden': 'true' }, target ? '📋' : '🛠️'),
          h('span', null, target ? 'Plan' : 'Build'),
          h('span', { style: hintStyle, 'aria-hidden': 'true' }, '⇥ Tab'),
        ]),
        h('button', {
          type: 'button',
          onClick: openSettings,
          title: '设置各模式预设模型 (默认跟随当前模型)',
          'aria-label': '设置模式预设模型',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            width: '22px',
            padding: 0,
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--dsw-radius-sm, 6px)',
            color: 'var(--dsw-alias-label-tertiary, #8c8c8c)',
            cursor: 'pointer',
            fontSize: '12px',
          },
        }, '⚙️'),
        showSettings ? h(ModeSettingsModal, {
          onClose: () => setShowSettings(false),
          catalogGroups: catalogGroups,
          currentSelection: currentSelection,
          catalogDefault: catalogDefault,
        }) : null,
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
            getCatalog: () => (ctx.remote && ctx.remote.session ? ctx.remote.session.modelCatalog() : null),
          }),
        }, ModeSwitcherControl));
      },
    };
  },
});
