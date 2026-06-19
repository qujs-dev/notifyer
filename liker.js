﻿/*!
 * Liker v1.0
 * Universal voting/rating library
 *  
 * @author Serge Galich
 * @license MIT
 * @website http://qujs.ru/liker/
 */
(function(global) {
    'use strict';
    const LIB_NAME = 'Liker';
    const DATA_PREFIX = 'qu-liker';

    if (global.Qu && global.Qu[LIB_NAME]) {
        global.Qu.debug(`⚠️ [${LIB_NAME}] Already registered`);
        return;
    }

    let Qu = null;
    let _initOnce = false;
    let _observers = [];

    const _defaultConfig = {
        action_url: '',
        use_grecaptcha: false,
        gre_captcha_action: 'liker',
        gre_captcha_token_input: '',

        storage_key: 'liker_votes',
        channel_key: 'liker_voted',
        sync_match_fields: ['target_id', 'target_key', 'type', 'tag'],
        action_field: 'action',
        action_value: 'like',
        action_valueSync: 'total',
        value_field: 'value',
        store_fields: ['user_value'], 
        observer_root: null,
        
        lexicon: {
            success: 'Успех',
            error: 'Ошибка',
            error_form: 'Ошибка отправки формы.',
            error_form_init: 'Форма не инициализирована на странице.',
            error_captcha: 'Ошибка проверки reCAPTCHA. Попробуйте позже.'
        },

        disableNotifier: false,
        notifyer: {
            default: { position: 'center-center' },
            success: { autohide: true },
            error: { autohide: false }
        }
    };

    function buildCompositeKey(inst) {
        const fields = inst.config.sync_match_fields;
        return fields.map(f => inst[f] !== undefined ? inst[f] : '').join(':');
    }

    function Constructor(params = {}) {
        const config = Constructor.mergeDeep({}, _defaultConfig, params);
        this.config = config;
        Object.assign(this, config);
        this._voting = false;

        this.type = this.type || 'like';
        const typeHandler = Constructor.getType(this.type);
        if (!typeHandler) {
            Constructor.debug(`❌ [${LIB_NAME}] Unknown type "${this.type}", fallback to "like"`);
            this.type = 'like';
            this._typeHandler = Constructor.getType('like');
        } else {
            this._typeHandler = typeHandler;
        }

        let pendingVotedValue = null;
        const compositeKey = buildCompositeKey(this);
        const votes = Constructor._getVotes();
        const myVote = votes[compositeKey];

        if (myVote && myVote.user_value !== undefined) {
            pendingVotedValue = parseInt(myVote.user_value, 10);
        }

        if (this._typeHandler?.initUI) {
            this._typeHandler.initUI(this);
        }

        if (pendingVotedValue !== null && this._typeHandler?.setVotedState) {
            this._typeHandler.setVotedState(this, pendingVotedValue);
        }

        Constructor.debug(`🧩 [${LIB_NAME}] instance created`, this);
    }
    Constructor._debug = false; // true by default

    Constructor.libName = LIB_NAME;

    Constructor._setData = function(el, name, value, prefix = DATA_PREFIX) {
        el.setAttribute(`data-${prefix}-${name}`, value ?? '');
    };

    Constructor._getData = function(el, name, prefix = DATA_PREFIX) {
        if (!el || typeof el.getAttribute !== 'function') return null;
        return el.getAttribute(`data-${prefix}-${name}`);
    };

    Constructor._hasData = function(el, name, prefix = DATA_PREFIX) {
        if (!el || typeof el.hasAttribute !== 'function') return false;
        return el.hasAttribute(`data-${prefix}-${name}`);
    };

    Constructor._removeData = function(el, name, prefix = DATA_PREFIX) {
        el.removeAttribute(`data-${prefix}-${name}`);
    };

    Constructor._getDataAttrName = function(name, prefix = DATA_PREFIX) {
        return `data-${prefix}-${name}`;
    };

    // ---------- Хелперы для типов ----------
    Constructor.findByData = function(el, name) {
        return el.querySelector(`[${Constructor._getDataAttrName(name)}]`);
    };

    Constructor.findAllByData = function(el, name) {
        return el.querySelectorAll(`[${Constructor._getDataAttrName(name)}]`);
    };

    Constructor.setText = function(el, value) {
        if (el) el.textContent = value;
    };

    Constructor.toggleAttr = function(el, attr, condition) {
        if (el) el.toggleAttribute(attr, condition);
    };

    // ---------- Адаптер к Qu ----------
    Constructor._Qu = {
        debug: (...args) => (Qu && Qu.debug ? Qu.debug(...args) : console.log(...args)),
        loading: (state, el) => {
            if (Qu && Qu.loading) return Qu.loading(state, el);
            if (el) el.style.opacity = state ? 0.5 : 1;
        },
        trigger: (el, ev, opts) => (Qu && Qu.trigger ? Qu.trigger(el, ev, opts) : null),
        on: (...args) => {
            if (Qu && Qu.on) return Qu.on(...args);
            return null;
        },
        dom: () => (Qu && Qu.dom ? Qu.dom() : Promise.resolve()),
        get Notifyer() {
            if (Qu && Qu.Notifyer) return Qu.Notifyer;
            return {
                success: (msg, opts) => alert((opts?.title || '✅') + '\n\n' + msg),
                error: (msg, opts) => alert((opts?.title || '❌') + '\n\n' + msg),
                info: (msg, opts) => alert((opts?.title || 'ℹ️') + '\n\n' + msg),
                warning: (msg, opts) => alert((opts?.title || '⚠️') + '\n\n' + msg)
            };
        },
        get GreCaptcha() {
            return (Qu && Qu.GreCaptcha) ? Qu.GreCaptcha : null;
        }
    };

    Constructor.debug = function(...args) {
        if (!Constructor._debug) return;
        Constructor._Qu.debug(...args);
    };

    Constructor.use = function(fn) {
        if (typeof fn === 'function') fn(Constructor, Qu);
    };

    Constructor.extend = function() {
        if (Array.isArray(global[LIB_NAME + 'Extend'])) {
            global[LIB_NAME + 'Extend'].forEach(fn => Constructor.use(fn));
            global[LIB_NAME + 'Extend'] = [];
        }
    };

    // ---------- Реестр типов ----------
    Constructor._types = {};
    Constructor.registerType = function(typeName, handler) {
        Constructor._types[typeName] = handler;
        Constructor.debug(`📦 [${LIB_NAME}] Type "${typeName}" registered`);
    };
    Constructor.getType = function(typeName) {
        return Constructor._types[typeName] || null;
    };

    Constructor.extendType = function(typeName, extension) {
        const original = this._types[typeName];
        if (!original) return;
        this._types[typeName] = Object.assign({}, original, extension);
    };

    // ---------- Загрузка и инициализация ----------
    Constructor.loaded = function(quInstance) {
        Qu = quInstance;
        Constructor.extend();
        Constructor.debug(`📗 [${LIB_NAME}] loaded`);
    };

    Constructor.init = function(quInstance, params = {}) {
        Qu = quInstance;

        // todo?
        Constructor._Qu.trigger(document.body, 'liker:beforeInit', {
            detail: { Qu, Liker: Constructor }
        });

        Constructor._initOnce(params);
        Constructor.config(params);
        Constructor.debug(`⚙️ [${LIB_NAME}] init`, _defaultConfig);
        Constructor._initExisting();
    };


    Constructor._initOnce = function(params = {}) {
        if (_initOnce) return;
        _initOnce = true;
    
        if (!_observers.length) {
            const observerCallback = mutations => {
                mutations.forEach(mut => {
                    if (mut.type !== 'childList' || !mut.addedNodes.length) return;
    
                    mut.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
    
                        if (node.hasAttribute?.(`data-${DATA_PREFIX}`)) {
                            Constructor._initElement(node);
                            return;
                        }
    
                        const likers = node.querySelectorAll?.(`[data-${DATA_PREFIX}]`);
                        if (likers?.length) {
                            likers.forEach(el => Constructor._initElement(el));
                        }
                    });
                });
            };
    
            let observerRoots = [];
    
            if (!params.observer_root) {
                observerRoots = [document.body];
            } else if (typeof params.observer_root === 'string') {
                observerRoots = Array.from(document.querySelectorAll(params.observer_root));
            } else if (params.observer_root instanceof Element) {
                observerRoots = [params.observer_root];
            } else if (params.observer_root instanceof NodeList || Array.isArray(params.observer_root)) {
                observerRoots = Array.from(params.observer_root).filter(Boolean);
            }
    
            if (!observerRoots.length) {
                observerRoots = [document.body];
            }
    
            observerRoots = [...new Set(observerRoots)];
    
            observerRoots.forEach(root => {
                const observer = new MutationObserver(observerCallback);
                observer.observe(root, { childList: true, subtree: true });
                _observers.push(observer);
                Constructor.debug(`👁️ [${LIB_NAME}] MutationObserver started`, root);
            });
        }
    
        Constructor._Qu.on('click', `[data-${DATA_PREFIX}]`, (e) => {
            const likerEl = e._target;
            const instance = likerEl._likerInstance;
            if (!instance) return;
    
            const target = e.target;
            if (instance._typeHandler?.handleClick) {
                instance._typeHandler.handleClick(instance, target, e);
            } else if (instance._typeHandler?.handleVote) {
                const value = target.closest('[data-value]')?.dataset.value;
                if (value !== undefined) {
                    instance._typeHandler.handleVote(instance, value);
                }
            }
        });
    
        if (!Constructor._channel) {
            Constructor._channel = new BroadcastChannel(_defaultConfig.channel_key);
            Constructor._channel.onmessage = (e) => {
                if (e.data.type === 'vote_registered') {
                    const { compositeKey, data, match, fields } = e.data;
    
                    const votes = Constructor._getVotes();
                    if (data === null) {
                        delete votes[compositeKey];
                    } else {
                        votes[compositeKey] = data;
                    }
                    Constructor._setVotes(votes);
    
                    let selector = `[data-${DATA_PREFIX}]`;
                    for (let key in match) {
                        const attrName = Constructor._getDataAttrName(key.replace(/_/g, '-'));
                        selector += `[${attrName}="${match[key]}"]`;
                    }
    
                    document.querySelectorAll(selector).forEach(el => {
                        const inst = el._likerInstance;
                        if (!inst) return;
    
                        if (inst._typeHandler?.updateUI) {
                            inst._typeHandler.updateUI(inst, fields);
                        }
                        inst._updateFieldsFromData(fields);
                        if (inst._typeHandler?.setVotedState) {
                            inst._typeHandler.setVotedState(inst, data ? data.user_value : null);
                        }
                    });
                }
    
                if (e.data.type === 'liker_sync') {
                    const votes = e.data.votes || {};
                    Constructor._setVotes(votes);
                    Constructor._updateAllInstancesFromStorage();
                }
            };
        }
    
        Constructor._Qu.on('storage', window, (event) => {
            if (event.key === _defaultConfig.storage_key) {
                if (event.newValue === null || event.newValue === '{}') {
                    Constructor._updateAllInstancesFromStorage();
                    Constructor.debug(`🛠️ [${LIB_NAME}] Storage cleared, all votes reset`);
                }
            }
        });
    };

    Constructor.disconnectObservers = function() {
        if (!_observers?.length) return;
    
        _observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (e) {}
        });
    
        _observers = [];
        _initOnce = false;
    
        Constructor.debug(`🛑 [${LIB_NAME}] All MutationObservers disconnected`);
    };

    Constructor.config = function(options) {
        Constructor.mergeDeep(_defaultConfig, options);
        return Constructor;
    };

    Constructor.mergeDeep = function(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        if (source && typeof source === 'object') {
            for (const key in source) {
                if (!Object.hasOwn(source, key)) continue;
                const srcVal = source[key];
                const tgtVal = target[key];
                if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal) &&
                    tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
                    Constructor.mergeDeep(tgtVal, srcVal);
                } else if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
                    target[key] = srcVal.slice();
                } else {
                    target[key] = srcVal;
                }
            }
        }
        return Constructor.mergeDeep(target, ...sources);
    };

    Constructor._initExisting = function() {
        document.querySelectorAll(`[data-${DATA_PREFIX}]`).forEach(el => {
            Constructor._initElement(el);
        });
    };

    Constructor._initElement = function(el) {
        if (el._liker) return;

        const params = Constructor._parseDataAttributes(el);
        params.element = el;

        const instance = new Constructor(params);
        instance._rawParams = params;

        el._likerInstance = instance;
        el._liker = true;
    };

    const parentParamsCache = new WeakMap();

    Constructor._parseDataAttributes = function(el) {
        const params = {};
        const prefix = 'data-' + DATA_PREFIX + '-';
        const prefixLen = prefix.length;

        const inheritAttr = Constructor._getDataAttrName('inherit');
        const inherit = el.getAttribute(inheritAttr) !== 'false';

        collectAttributes(el, params);

        if (inherit) {
            let parent = el.parentElement;
            while (parent) {
                if (hasLikerAttributes(parent)) {
                    let parentParams = parentParamsCache.get(parent);
                    if (!parentParams) {
                        parentParams = {};
                        collectAttributes(parent, parentParams);
                        parentParamsCache.set(parent, parentParams);
                    }

                    for (let key in parentParams) {
                        if (!params.hasOwnProperty(key)) {
                            params[key] = parentParams[key];
                        }
                    }
                    break;
                }
                parent = parent.parentElement;
                if (parent === document.body) break;
            }
        }

        return params;

        function hasLikerAttributes(element) {
            for (const attr of element.attributes) {
                if (attr.name.startsWith(prefix)) return true;
            }
            return false;
        }

        function collectAttributes(element, target, skipExisting = false) {
            for (const attr of element.attributes) {
                if (!attr.name.startsWith(prefix)) continue;

                let key = attr.name.slice(prefixLen).replace(/-/g, '_');
                if (skipExisting && target.hasOwnProperty(key)) continue;

                let value = attr.value;
                if (value && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {}
                }
                target[key] = value;
            }
        }
    };

    
    Constructor._getVotes = function() {
        const raw = localStorage.getItem(_defaultConfig.storage_key);
        return raw ? JSON.parse(raw) : {};
    };

    Constructor._setVotes = function(votes) {
        localStorage.setItem(_defaultConfig.storage_key, JSON.stringify(votes));
    };

    // ---------- Встроенные типы  ----------
    Constructor.registerType('like', {
        initUI(inst) {
            inst.btn = inst.element.querySelector(`[${Constructor._getDataAttrName('btn')}="like"]`) ||
                       inst.element.querySelector('.liker-btn, .like');
            inst.countSpan = inst.btn?.querySelector(`[${Constructor._getDataAttrName('count')}]`) ||
                             inst.btn?.querySelector('.likes-count');


            if (inst.btn) {
                inst.isLiked = inst.isLiked || false;
                inst.total = inst.total || 0;
                this.updateUI(inst, { total: inst.total, user_value: inst.isLiked ? 1 : 0 });
            }
        },
        handleClick(inst) { inst._vote(1); },
        updateUI(inst, data) {
            inst.total = data.total ?? 0;
        
            if (Object.prototype.hasOwnProperty.call(data, 'user_value')) {
                inst.isLiked = data.user_value == 1;
                Constructor.toggleAttr(inst.btn, 'data-qu-liker-active', inst.isLiked);
            }
        
            Constructor.setText(inst.countSpan, data.total);
        },
        setVotedState(inst, userValue) {
            inst.isLiked = userValue === 1;
            Constructor.toggleAttr(inst.btn, 'data-qu-liker-active', inst.isLiked);
            if (userValue !== null && userValue !== undefined) {
                inst.element.setAttribute('data-qu-liker-voted', '');
            } else {
                inst.element.removeAttribute('data-qu-liker-voted');
            }
        }
    });

    Constructor.registerType('stars', {
        initUI(inst) {
            inst.container = Constructor.findByData(inst.element, 'stars-container');
            inst.stars = inst.container ? Constructor.findAllByData(inst.container, 'star') : null;
            inst.averageSpan = Constructor.findByData(inst.element, 'average');
            inst.votesSpan = Constructor.findByData(inst.element, 'votes');
            inst.maxStars = parseInt(inst.max) || 5;


            let initialRating = parseFloat(inst.current);
            if (isNaN(initialRating) && inst.averageSpan) {
                initialRating = parseFloat(inst.averageSpan.textContent);
            }
            inst.currentRating = !isNaN(initialRating) ? initialRating : 0;

            if (inst.stars?.length) this._renderStars(inst);

            inst.container?.addEventListener('click', (e) => {
                const star = e.target.closest(`[${Constructor._getDataAttrName('star')}]`);
                if (!star) return;
                const value = parseInt(star.dataset.value);
                if (!isNaN(value)) inst._vote(value);
            });
        },
        _renderStars(inst) {
            const rating = inst.currentRating;
            inst.stars.forEach((star, idx) => {
                const starValue = idx + 1;
                let fill = rating >= starValue ? 100 : (rating > starValue - 1 ? (rating - (starValue - 1)) * 100 : 0);
                star.style.setProperty('--fill-percent', Math.min(100, Math.max(0, fill)));
            });
        },
        
        _highlightSelectedStar(inst, userValue) {
            if (!inst.stars) return;
            const activeAttr = 'data-qu-liker-star-active';
            inst.stars.forEach(star => {
                const starValue = parseInt(star.dataset.value);
                if (!isNaN(starValue) && starValue === userValue) {
                    star.setAttribute(activeAttr, '');
                } else {
                    star.removeAttribute(activeAttr);
                }
            });
        },
        handleVote(inst, value) { return inst._vote(value); },
        updateUI(inst, data) {
            inst.currentRating = parseFloat(data.avg_rating) || 0;
            inst.total = parseInt(data.total_votes) || 0;
        
            Constructor.setText(inst.averageSpan, inst.currentRating.toFixed(1));
            Constructor.setText(inst.votesSpan, inst.total);
        
            if (inst.stars?.length) this._renderStars(inst);
        
            if (Object.prototype.hasOwnProperty.call(data, 'user_value')) {
                this._highlightSelectedStar(inst, data.user_value);
            }
        
            const percents = data.stars_percents || {};
            for (let star = 1; star <= inst.maxStars; star++) {
                const percent = percents[star] ?? 0;
                const percentEl = inst.element.querySelector(`[data-qu-liker-field="stars_distribution.${star}_percent"]`);
                if (percentEl) Constructor.setText(percentEl, percent + '%');
        
                const barFill = inst.element.querySelector(`[data-qu-liker-field="stars_distribution.${star}"]`);
                if (barFill?.classList.contains('liker-bar-fill')) {
                    barFill.style.width = percent + '%';
                }
            }
        },
        setVotedState(inst, userValue) {
            this._highlightSelectedStar(inst, userValue);
            if (userValue !== null && userValue !== undefined) {
                inst.element.setAttribute('data-qu-liker-voted', '');
            } else {
                inst.element.removeAttribute('data-qu-liker-voted');
            }
        },
    });

    Constructor.registerType('emoji', {
        initUI(inst) {
            inst.triggerBtn = Constructor.findByData(inst.element, 'emoji-trigger');
            inst.palette = Constructor.findByData(inst.element, 'emoji-palette');
            inst.currentEmojiSpan = Constructor.findByData(inst.element, 'emoji-current');
            inst.countSpan = Constructor.findByData(inst.element, 'emoji-count');
            inst.placeholderBtn = inst.element.querySelector('[data-qu-liker-emoji-placeholder]');
    
            if (!inst.currentValue && inst.currentEmojiSpan) {
                const currentId = inst.currentEmojiSpan.getAttribute(Constructor._getDataAttrName('emoji-current'));
                if (currentId) {
                    inst.currentValue = currentId;
                } else {
                    const defaultOption = inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-default')}]`)
                                        || inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-value')}]`);
                    if (defaultOption) {
                        inst.currentValue = defaultOption.getAttribute(Constructor._getDataAttrName('emoji-value'));
                    }
                }
            }
    
            inst.openPalette = () => inst.element.setAttribute('data-qu-liker-emoji-open', '');
            inst.closePalette = () => inst.element.removeAttribute('data-qu-liker-emoji-open');
    
            inst.triggerBtn?.addEventListener('mouseenter', inst.openPalette);
            inst.element.addEventListener('mouseleave', inst.closePalette);
    
            let pressTimer;
            inst.triggerBtn?.addEventListener('touchstart', () => {
                pressTimer = setTimeout(inst.openPalette, 500);
            });
            inst.triggerBtn?.addEventListener('touchend', () => clearTimeout(pressTimer));
            inst.triggerBtn?.addEventListener('touchmove', () => clearTimeout(pressTimer));
    
            document.addEventListener('click', (e) => {
                if (!inst.element.contains(e.target)) inst.closePalette();
            });
    
        },
    
        _updateSelectedEmoji(inst, value) {
            if (!inst.currentEmojiSpan) return;
            const option = inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-value')}="${value}"]`);
            if (option) {
                inst.currentEmojiSpan.innerHTML = option.innerHTML;
            }
        },
    
        handleClick(inst, target, event) {
            if (target.closest(`[${Constructor._getDataAttrName('emoji-trigger')}]`)) {
                event.stopPropagation();
                let value = inst.currentValue;
                if (!value) {
                    const defaultOption = inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-default')}]`)
                                        || inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-value')}]`);
                    value = defaultOption ? defaultOption.getAttribute(Constructor._getDataAttrName('emoji-value')) : null;
                }
                if (value) {
                    inst.closePalette();
                    inst._vote(value);
                }
                return;
            }
    
            const emojiOption = target.closest(`[${Constructor._getDataAttrName('emoji-value')}]`);
            if (emojiOption) {
                const value = emojiOption.getAttribute(Constructor._getDataAttrName('emoji-value'));
                inst.closePalette();
                inst._vote(value);
                event.stopPropagation();
                return;
            }
    
            inst.closePalette();
        },
    
        setVotedState(inst, userValue) {
            if (userValue === null) {
                inst.element.removeAttribute('data-qu-liker-voted');
                if (inst.currentEmojiSpan) {
                    let targetHtml = '';
                    if (inst.placeholderBtn) {
                        targetHtml = inst.placeholderBtn.innerHTML;
                    } else {
                        const defaultOption = inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-default')}]`)
                                            || inst.palette?.querySelector(`[${Constructor._getDataAttrName('emoji-value')}]`);
                        if (defaultOption) targetHtml = defaultOption.innerHTML;
                    }
                    if (targetHtml) inst.currentEmojiSpan.innerHTML = targetHtml;
                }
                inst.currentValue = null;
            } else {
                inst.currentValue = userValue;
                this._updateSelectedEmoji(inst, userValue);
                inst.element.setAttribute('data-qu-liker-voted', '');
            }
        },
    
        updateUI(inst, data) {
            Constructor.setText(inst.countSpan, data.total_votes);
            if (data.user_value !== undefined) {
                inst.currentValue = data.user_value;
                this._updateSelectedEmoji(inst, data.user_value);
                inst.element.setAttribute('data-qu-liker-voted', '');
            }

            const stats = data.stats || {};
            const percents = data.emoji_percents || {};
            for (let [value, count] of Object.entries(stats)) {
                const percent = percents[value] ?? 0;
                Constructor.setText(inst.element.querySelector(`[data-qu-liker-field="stats.${value}"]`), count);
                Constructor.setText(inst.element.querySelector(`[data-qu-liker-field="stats.${value}_percent"]`), percent + '%');
                const bar = inst.element.querySelector(`[data-qu-liker-field="stats.${value}_bar"]`);
                if (bar?.classList.contains('liker-bar-fill')) bar.style.width = percent + '%';
            }
        }
    });

    Constructor.registerType('thumbs', {
        initUI(inst) {
            inst.upBtn = inst.element.querySelector('[data-qu-liker-btn="thumbs-up"]');
            inst.downBtn = inst.element.querySelector('[data-qu-liker-btn="thumbs-down"]');
            
            if (inst._voted) {
                
            }
        },
        handleClick(inst, target) {
            const btn = target.closest('[data-qu-liker-btn]');
            if (!btn) return;
            const value = parseInt(btn.dataset.value);
            if (!isNaN(value)) inst._vote(value);
        },
        updateUI(inst, data) {
            const uv = data.user_value;
            if (uv !== undefined) {
                Constructor.toggleAttr(inst.upBtn, 'data-qu-liker-active', uv == 1);
                Constructor.toggleAttr(inst.downBtn, 'data-qu-liker-active', uv == -1);
            }

            const scoreEl = inst.element.querySelector('[data-qu-liker-thumbs-class]');
            if (scoreEl) {
                if (data.score_class !== undefined) {
                    scoreEl.setAttribute('data-qu-liker-thumbs-class', data.score_class);
                }
            }
        },
        setVotedState(inst, userValue) {
            Constructor.toggleAttr(inst.upBtn, 'data-qu-liker-active', userValue == 1);
            Constructor.toggleAttr(inst.downBtn, 'data-qu-liker-active', userValue == -1);
            if (userValue !== null && userValue !== undefined) {
                inst.element.setAttribute('data-qu-liker-voted', '');
            } else {
                inst.element.removeAttribute('data-qu-liker-voted');
            }
        }
    });

    // ---------- Методы экземпляра ----------
    Constructor.prototype = {
        constructor: Constructor,

        use: function(fn) {
            if (typeof fn === 'function') fn(this);
        },

        _getSyncMatchObject: function() {
            const obj = {};
            const fields = this.config.sync_match_fields;
            fields.forEach(field => {
                if (this[field] !== undefined) obj[field] = this[field];
            });
            return obj;
        },

        async _vote(value) {
            if (this._voting) return;
            this._voting = true;
            Constructor._Qu.loading(true, this.element);

            Constructor._Qu.trigger(this.element, 'liker:beforeVote', {
                detail: { instance: this, value, mutate: true }
            });

            try {
                const formData = new FormData();
                const params = this._rawParams;

                for (let key in params) {
                    if (!params.hasOwnProperty(key)) continue;
                    if (key === 'element' || key === 'config' || key.startsWith('_')) continue;

                    let val = params[key];
                    if (val === undefined || val === null) continue;
                    if (typeof val === 'function') continue;

                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        val = JSON.stringify(val);
                    }
                    formData.append(key, val);
                }

                if (!params.hasOwnProperty(this.action_field)) {
                    formData.append(this.action_field, this.action_value);
                }
                if (!params.hasOwnProperty(this.value_field)) {
                    formData.append(this.value_field, value);
                }

                if (this.use_grecaptcha && Constructor._Qu.GreCaptcha) {
                    const grecaptcha = Constructor._Qu.GreCaptcha;
                    if (grecaptcha._config?.enabled && grecaptcha._config?.siteKey) {
                        try {
                            const token = await grecaptcha.check(this.gre_captcha_action || 'liker');
                            const tokenField = this.gre_captcha_token_input 
                                            || grecaptcha._config?.tokenInput 
                                            || 'g-recaptcha-response';
                            formData.append(tokenField, token);
                        } catch (e) {
                            Constructor.debug('❌ GreCaptcha failed:', e);
                            this._showMessage('error', { 
                                message: e.message || this.config.lexicon.error_captcha  
                            });
                            return; 
                        }
                    }
                }

                const res = await fetch(this.action_url, { method: 'POST', body: formData });
                const data = await res.json();

                        
                Constructor._Qu.trigger(this.element, 'liker:afterVote', {
                    detail: { instance: this, response: data, mutate: true }
                });

                if (data.success) {
                    const payload = data.data || data;
                    this._typeHandler?.updateUI?.(this, payload);
                    this._updateFieldsFromData(payload);
                    this._saveVote(payload);

                    const compositeKey = buildCompositeKey(this);
                    document.querySelectorAll(`[data-${DATA_PREFIX}]`).forEach(el => {
                        const inst = el._likerInstance;
                        if (!inst || inst === this) return;
                        const instKey = buildCompositeKey(inst);
                        if (instKey === compositeKey) {
                            if (inst._typeHandler?.updateUI) {
                                inst._typeHandler.updateUI(inst, payload);
                            }
                            inst._updateFieldsFromData(payload); // оставить для обновления data-qu-liker-field
                            if (inst._typeHandler?.setVotedState) {
                                inst._typeHandler.setVotedState(inst, payload.user_value !== undefined ? payload.user_value : null);
                            }
                            inst._voted = (payload.user_value !== null && payload.user_value !== undefined);
                        }
                    });

                    if (data.message) {
                        this._showMessage('success', data);
                    }
                } else {
                    this._updateFieldsFromData(data);
                    this._showMessage('error', data);
                }
            } catch (err) {
                const errorResponse = { success: false, message: err.message };
                Constructor._Qu.trigger(this.element, 'liker:afterVote', {
                    detail: { instance: this, response: errorResponse }
                });

                this._showMessage('error', { message: err.message || this.config.lexicon.error_form });

            } finally {
                Constructor._Qu.loading(false, this.element);
                this._voting = false;
            }
        },

        _updateFieldsFromData(responseData) {
            const selector = `[${Constructor._getDataAttrName('field')}]`;
            const fieldElements = this.element.querySelectorAll(selector);
            fieldElements.forEach(el => {
                const path = Constructor._getData(el, 'field');
                if (!path) return;

                const value = this._getNestedValue(responseData, path);
                if (value === undefined) return;

                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    el.value = value;
                } else {
                    el.textContent = value;
                }
            });
        },

        _getNestedValue(obj, path) {
            return path.split('.').reduce((current, key) => {
                return current && typeof current === 'object' && key in current ? current[key] : undefined;
            }, obj);
        },

        _saveVote(payload) {
            const userValue = payload.user_value;
            const compositeKey = buildCompositeKey(this);
        
            const votes = Constructor._getVotes();
        
            if (userValue === null || userValue === undefined) {
                delete votes[compositeKey];
            } else {
                // Сохраняем только user_value (и другие поля из store_fields, но не id)
                const dataToStore = {};
                const storeFields = this.config.store_fields;
                storeFields.forEach(field => {
                    if (payload[field] !== undefined) dataToStore[field] = payload[field];
                });
                votes[compositeKey] = dataToStore;
            }
        
            Constructor._setVotes(votes);
        
            this._voted = (userValue !== null && userValue !== undefined);
            if (this._typeHandler?.setVotedState) {
                this._typeHandler.setVotedState(this, userValue);
            }
        
            if (Constructor._channel) {
                Constructor._channel.postMessage({
                    type: 'vote_registered',
                    compositeKey: compositeKey,
                    data: userValue === null ? null : votes[compositeKey],
                    match: this._getSyncMatchObject(),
                    fields: payload
                });
            }

            if (userValue !== null && userValue !== undefined) {
                this.element.setAttribute('data-qu-liker-voted', '');
            } else {
                this.element.removeAttribute('data-qu-liker-voted');
            }
        },

        _showMessage(type, data) {
            if (this.config.disableNotifier) {
                return;
            }
            const handler = this.config.message_handler || Constructor.defaultShowMessage;
            handler(this, type, data);
        }
    };

    Constructor.defaultShowMessage = function(instance, type, data) {
        const cfg = instance.config;
        const lexicon = cfg.lexicon;

        const title = data.message || (type === 'success' ? lexicon.success : lexicon.error);

        let message = '';
        if (data.data?.message) {
            message = data.data.message;
        } else if (data.message && !data.data) {
            message = data.message;
        } else if (data.errors && Array.isArray(data.errors)) {
            message = data.errors.join('; ');
        } else {
            message = type === 'success' ? '' : lexicon.error_form;
        }

        const notifyType = data.data?.notify_type || type;

        let options = Object.assign({ title }, cfg.notifyer.default);

        switch (notifyType) {
            case 'success':
                options = Object.assign(options, cfg.notifyer.success);
                Constructor._Qu.Notifyer.success(message, options);
                break;
            case 'error':
                options = Object.assign(options, cfg.notifyer.error);
                Constructor._Qu.Notifyer.error(message, options);
                break;
            case 'info':
                options = Object.assign(options, cfg.notifyer.info || {});
                Constructor._Qu.Notifyer.info(message, options);
                break;
            case 'warning':
                options = Object.assign(options, cfg.notifyer.warning || {});
                Constructor._Qu.Notifyer.warning(message, options);
                break;
            default:
                Constructor._Qu.Notifyer.success(message, options);
        }
    };

    // ---------- Синхронизация с сервером
    Constructor.syncFromServer = function() {
        const url = _defaultConfig.action_url;
        if (!url) {
            Constructor.debug('❌ [Liker] syncFromServer: action_url is not set');
            return Promise.reject(new Error('action_url is not set'));
        }

        const body = new URLSearchParams();
        body.append(_defaultConfig.action_field, _defaultConfig.action_valueSync);

        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        })
        .then(response => response.json())
        .then(result => {
            if (result.success && result.data) {
                let votes = result.data.votes || {};
                if (Array.isArray(votes)) {
                    votes = {};
                }
                Constructor._setVotes(votes);
                Constructor._updateAllInstancesFromStorage();
                return votes;
            } else {
                throw new Error(result.message || 'Sync failed');
            }
        });
    };

    Constructor._updateAllInstancesFromStorage = function() {
        const votes = Constructor._getVotes();
        document.querySelectorAll(`[data-${DATA_PREFIX}]`).forEach(el => {
            const inst = el._likerInstance;
            if (!inst) return;
    
            const compositeKey = buildCompositeKey(inst);
            const myVote = votes[compositeKey];
    
            if (myVote && myVote.user_value !== undefined) {
                inst._voted = true;
                if (inst._typeHandler?.setVotedState) {
                    inst._typeHandler.setVotedState(inst, parseInt(myVote.user_value, 10));
                }
            } else {
                inst._voted = false;
                if (inst._typeHandler?.setVotedState) {
                    inst._typeHandler.setVotedState(inst, null);
                }
            }
        });
    };

    
    if (global.Qu) {
        global.Qu.lib(LIB_NAME, Constructor);
    } else {
        global._QuLibs = global._QuLibs || [];
        global._QuLibs.push({ name: LIB_NAME, instance: Constructor });
    }

})(typeof window !== 'undefined' ? window : global);