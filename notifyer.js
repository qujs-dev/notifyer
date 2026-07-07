/*!
 * Notifyer v1.0.3
 * Notification component
 *
 * @author Serge Galich <gaserge@mail.ru>
 * @copyright 2025
 * @license MIT
 * @website http://qujs.ru/notifyer/
 * 
 * @requires Qu
 */

(function (window, document) {
    'use strict';
    
    const LIB_NAME = 'Notifyer';
    const DATA_PREFIX = 'qu-notifyer';
    const QU_PREFIX = 'qu';

    if (window.Qu && window.Qu[LIB_NAME]) {
        window.Qu.debug(`⚠️ [${LIB_NAME}] Already registered, skipping duplicate`);
        return;
    }
    
    let Qu = null;
    let _initOnce = false;

    const _defaultConfig = {
        cssPrefix: 'notifyer',
        autohide: true,
        timeout: 3000,
        layer: 'auto',
        position: 'top-center',
        maxNotifications: 5,
        showCloseAllButton: false,
        closeAllThreshold: 2, 
        animationOpen: 'slide-down',
        animationClose: 'fade',
        animationDuration: 300,
        template: null,
        clickToClose: false, 
        
        lexicon: {
            closeAll: 'закрыть все <span aria-hidden="true">×</span>',
            close: 'Закрыть'
        }
    };

    function Constructor(params = {}) {
        if (params.title || params.text) {
            return this._createNotificationInstance(params);
        }
        this._config = Object.assign({}, _defaultConfig);
    }
    Constructor._debug = false; // true by default
    Constructor.libName = LIB_NAME;
    
    Constructor._setData = function(el, name, value, prefix = DATA_PREFIX) {
        const attrName = `data-${prefix}-${name}`;
        if (value === undefined) {
            el.setAttribute(attrName, '');
        } else {
            el.setAttribute(attrName, value);
        }
    };

    Constructor._getData = function(el, name, prefix = DATA_PREFIX) {
        if (!el || typeof el.getAttribute !== 'function') {
            return null;
        }
        return el.getAttribute(`data-${prefix}-${name}`);
    };

    Constructor._hasData = function(el, name, prefix = DATA_PREFIX) {
        if (!el || typeof el.hasAttribute !== 'function') {
            return false;
        }
        return el.hasAttribute(`data-${prefix}-${name}`);
    };

    Constructor._removeData = function(el, name, prefix = DATA_PREFIX) {
        el.removeAttribute(`data-${prefix}-${name}`);
    };

    Constructor._Qu = {

        debug: function(...args) {
            if (Qu && Qu.debug) return Qu.debug(...args);
            console.log(...args)
        },
        on: function(el, ev, handler, opts) {
            if (Qu && Qu.on) { return Qu.on(el, ev, handler, opts); }
            
            if (typeof ev !== 'string' && ev.addEventListener) {
                if (typeof el === 'string') {
                    el = el.split(' ').filter(e => e.trim());
                }

                el.forEach(el => {
                    ev.addEventListener(el.trim(), handler, opts);
                });
                return;
            }
            
            if (typeof ev === 'string') {
                if (typeof el === 'string') {
                    el = el.split(' ').filter(e => e.trim());
                }
                el.forEach(el => {
                    document.addEventListener(el.trim(), function(event) {
                        const target = event.target.closest(ev);
                        if (target) {
                            event._target = target;
                            handler(event);
                        }
                    }, opts);
                });
                
                return;
            }
        },
    };

    Constructor.use = function (fn) {
        if (typeof fn === 'function') {
          fn(Constructor, Qu);
        }
    };

    Constructor.extend = function () {
        if (Array.isArray(window[LIB_NAME + 'Extend'])) {
          window[LIB_NAME + 'Extend'].forEach((fn) => {
            Constructor.use(fn);
          });
          window[LIB_NAME + 'Extend'] = [];
        }
    };

    Constructor.loaded = function(quInstance) {
        Qu = quInstance;
        Constructor.extend();
        Constructor.debug(`📗 [${LIB_NAME}] loaded`);
    };


    Constructor.debug = function(...args) {
        if (!Constructor._debug) return;
        Constructor._Qu.debug(...args);
    },

    Constructor.initOnce = function(params = {}) {
        if(_initOnce === true) return;
        _initOnce = true;
    };

    Constructor.init = function(quInstance, params = {}) {
        Qu = quInstance;
        Constructor.initOnce(params);
        Constructor.config(params);
        Constructor.debug(`⚙️ [${LIB_NAME}] init`, _defaultConfig);
    };

    Constructor.config = function(options) {
        Object.assign(_defaultConfig, options);
        return Constructor;
    };

    Constructor.show = function(params = {}) {
        const instance = new Constructor();
        return instance._createNotificationInstance(params);
    };

    Constructor.success = function(text, options = {}) {
        const instance = new Constructor();
        return instance._createNotificationInstance({
            text: text,
            className: 'theme-success',
            ...options
        });
    };

    Constructor.error = function(text, options = {}) {
        const instance = new Constructor();
        return instance._createNotificationInstance({
            text: text,
            className: 'theme-error',
            autohide: false,
            ...options
        });
    };

    Constructor.info = function(text, options = {}) {
        const instance = new Constructor();
        return instance._createNotificationInstance({
            text: text,
            className: 'theme-info',
            ...options
        });
    };

    Constructor.warning = function(text, options = {}) {
        const instance = new Constructor();
        return instance._createNotificationInstance({
            text: text,
            className: 'theme-warning',
            ...options
        });
    };

    Constructor.closeAll = function(layer = 'all') {
        const prefix = _defaultConfig.cssPrefix;
        const duration = _defaultConfig.animationDuration;
        
        if (layer === 'all') {
            document.querySelectorAll(`.${prefix}__el`).forEach(el => {
                Constructor._removeData(el, 'opening', QU_PREFIX);
                Constructor._setData(el, 'closing', '', QU_PREFIX);
                setTimeout(() => {
                    if (el.close) el.close();
                    el.remove();
                }, duration);
            });
        } else {
            const container = layer === 'global' 
                ? document.querySelector(`.${prefix}-global`)
                : document.querySelector(`#${prefix}-for-${layer}`);
                
            if (container) {
                container.querySelectorAll(`.${prefix}__el`).forEach(el => {
                    Constructor._removeData(el, 'opening', QU_PREFIX);
                    Constructor._setData(el, 'closing', '', QU_PREFIX);
                    setTimeout(() => {
                        if (el.close) el.close();
                        el.remove();
                    }, duration);
                });
            }
        }
    };

    Constructor.transferFromDialog = function(dialog) {
        const prefix = _defaultConfig.cssPrefix;
        const duration = _defaultConfig.animationDuration;
        
        const openDialogs = Array.from(document.querySelectorAll('dialog[open]')).filter(d => d.open);
        const dialogIndex = openDialogs.findIndex(d => d === dialog);
        const targetLayer = dialogIndex > 0 ? openDialogs[dialogIndex - 1] : 'global';
        
        const notificationContainers = dialog.querySelectorAll(`.${prefix}-container`);
        if (!notificationContainers.length) return;
        
        notificationContainers.forEach(container => {
            let targetPosition = null;
            
            if (targetLayer === 'global') {
                const globalContainer = document.querySelector(`.${prefix}-global`);
                if (globalContainer) {
                    const positionMatch = globalContainer.className.match(new RegExp(`${prefix}-global--([\\w_]+)`));
                    if (positionMatch) {
                        targetPosition = positionMatch[1];
                    }
                }
            } else {
                const layerContainer = targetLayer.querySelector(`.${prefix}-container`);
                if (layerContainer) {
                    const positionMatch = layerContainer.className.match(new RegExp(`${prefix}-container--([\\w_]+)`));
                    if (positionMatch) {
                        targetPosition = positionMatch[1];
                    }
                }
            }
            
            if (!targetPosition) {
                const positionMatch = container.className.match(new RegExp(`${prefix}-container--([\\w_]+)`));
                if (!positionMatch) return;
                targetPosition = positionMatch[1];
            }
            
            const notifications = container.querySelectorAll(`.${prefix}__el`);
            if (!notifications.length) return;
            
            notifications.forEach(notification => {
                const params = {
                    title: notification.querySelector(`.${prefix}__caption`)?.textContent || '',
                    text: notification.querySelector(`.${prefix}__text`)?.textContent || '',
                    className: Array.from(notification.classList)
                        .filter(cls => cls !== `${prefix}__el` && !cls.startsWith(`${prefix}__el--`))
                        .join(' '),
                    position: targetPosition.replace('_', '-'),
                    layer: targetLayer === 'global' ? 'global' : targetLayer.id || undefined,
                    autohide: Constructor._getData(notification, 'autohide') !== 'false',
                    timeout: Constructor._getData(notification, 'timeout') ? parseInt(Constructor._getData(notification, 'timeout')) : _defaultConfig.timeout,
                    animationOpen: Constructor._getData(notification, 'animation-open', QU_PREFIX) || _defaultConfig.animationOpen,
                    animationClose: Constructor._getData(notification, 'animation-close', QU_PREFIX) || _defaultConfig.animationClose
                };
                
                if (params.title || params.text) {
                    Constructor.show(params);
                }
            });
        });
        
        setTimeout(() => {
            notificationContainers.forEach(container => {
                container.remove();
            });
        }, 0);
    };
    

    Constructor.prototype = {
        constructor: Constructor,

        use: function(fn) {
            if (typeof fn === 'function') {
                fn(this);
            }
        },

        _createNotificationInstance: function(params = {}) {
            const config = Object.assign({}, _defaultConfig, params);

            Constructor.debug(`🧩 [${LIB_NAME}] creating notification`, {
                config: config
            });

            if (!config.title && !config.text) {
                console.error(`❌ [${LIB_NAME}]: title or text is required.`);
                return null;
            }

            this.$el = null;
            this.container = null;
            this.config = config;
            this._animationDuration = config.animationDuration;
            
            this.domCreate();
            this.showNotification();
            
            return this;
        },

        domCreate: function() {
            this._createNotificationElement();
            this.container = this._getContainerForLayer();
            this.container.prepend(this.$el);
            this._limitNotifications();
            this._updateCloseAllButton();
        },

        _createNotificationElement: function() {
            const prefix = this.config.cssPrefix;
            
            let el = document.createElement('dialog');
            Constructor._setData(el, 'notifyer', 'true', QU_PREFIX);
            Constructor._setData(el, 'autohide', this.config.autohide);
            Constructor._setData(el, 'timeout', this.config.timeout);
            Constructor._setData(el, 'position', this.config.position);
            Constructor._setData(el, 'layer', this.config.layer || 'auto');
            Constructor._setData(el, 'click-to-close', this.config.clickToClose);

            if (!this.config.modal) {
                Constructor._Qu.on('keydown', el, (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        this.hide();
                    }
                });
            }

            el.classList.add(`${prefix}__el`);
            el.classList.add(`${prefix}__el--${this.config.position.replace('-', '_')}`);
            
            Constructor._setData(el, 'animation-open', this.config.animationOpen, QU_PREFIX);
            Constructor._setData(el, 'animation-close', this.config.animationClose, QU_PREFIX);
            
            el.style.setProperty('--qu-transition-duration', `${this.config.animationDuration}ms`);
            
            if (this.config.className) {
                let classes = this.config.className.split(" ");
                classes.forEach(cl => {
                    el.classList.add(cl);
                });
            }

            let html = this.config.template;

            if (html === null) {
                html = `{title}{text}<button class="${prefix}__close" type="button" aria-label="${this.config.lexicon.close}"></button>`;
                let htmlTitle = this.config.title ? `<div class="${prefix}__caption"></div>` : '';
                let htmlText = this.config.text ? `<div class="${prefix}__text"></div>` : '';
                html = html.replace('{title}', htmlTitle).replace('{text}', htmlText);
            }
            
            el.innerHTML = html;

            if (this.config.title) {
                el.querySelector(`.${prefix}__caption`).innerHTML = this.config.title;
            }
            if (this.config.text) {
                el.querySelector(`.${prefix}__text`).innerHTML = this.config.text;
            }

            this.$el = el;

            const closeBtn = this.$el.querySelector(`.${prefix}__close`);
            if (closeBtn) {
                Constructor._Qu.on('click', closeBtn, (e) => {
                    e.stopPropagation();
                    this.hide();
                });
            }

            if (this.config.clickToClose) {
                Constructor._Qu.on('click', this.$el, (e) => {
                    this.hide();
                });
            }
        },

        _getContainerForLayer: function() {
            const layerId = this._resolveLayer();
            const prefix = this.config.cssPrefix;
            const position = this.config.position.replace('-', '_');
            
            const containerId = layerId ? 
                `${prefix}-for-${layerId}-${position}` : 
                `${prefix}-global-${position}`;
            
            let container = document.getElementById(containerId);
            
            if (!container) {
                container = this._createContainer(layerId);
            }
            
            return container;
        },

        _resolveLayer: function() {
            if (this.config.layer === 'global') return null;
            if (this.config.layer === 'auto') {
                return this._getActiveModalId();
            }
            return this.config.layer;
        },

        _getActiveModalId: function() {
            const modals = document.querySelectorAll('dialog[open]:modal');
            if (modals.length === 0) return null;
            
            const topModal = modals[modals.length - 1];
            
            if (topModal.id) return topModal.id;
            
            const tempId = `notifyer-layer-${Date.now()}`;
            topModal.setAttribute('data-notifyer-layer', tempId);
            return tempId;
        },

        _createContainer: function(layerId = null) {
            const prefix = this.config.cssPrefix;
            const position = this.config.position.replace('-', '_');
            const container = document.createElement('div');
            
            const containerId = layerId ? 
                `${prefix}-for-${layerId}-${position}` : 
                `${prefix}-global-${position}`;
            
            container.id = containerId;
            
            const containerClasses = [layerId ? `${prefix}-container` : `${prefix}-global`];
            
            if (layerId) {
                containerClasses.push(`${prefix}-container--${this.config.position.replace('-', '_')}`);
            } else {
                containerClasses.push(`${prefix}-global--${this.config.position.replace('-', '_')}`);
            }
            
            container.className = containerClasses.join(' ');

            if (this.config.showCloseAllButton) {
                container.dataset.showCloseAll = 'true';
                container.dataset.closeAllThreshold = this.config.closeAllThreshold;
            } else {
                container.dataset.showCloseAll = 'false';
            }
            
            if (layerId) {
                const parent = document.getElementById(layerId) || 
                              document.querySelector(`[data-notifyer-layer="${layerId}"]`);
                if (parent) {
                    parent.appendChild(container);
                } else {
                    container.className = `${prefix}-global ${prefix}-global--${this.config.position.replace('-', '_')}`;
                    document.body.appendChild(container);
                }
            } else {
                document.body.appendChild(container);
            }
            
            return container;
        },

        _limitNotifications: function() {
            const prefix = this.config.cssPrefix;
            const notifications = this.container.querySelectorAll(`.${prefix}__el`);
            const max = this.config.maxNotifications;
            
            if (notifications.length > max) {
                const toRemove = Array.from(notifications).slice(max);
                toRemove.forEach(notification => {
                    Constructor._removeData(notification, 'opening', QU_PREFIX);
                    Constructor._setData(notification, 'closing', '', QU_PREFIX);
                    setTimeout(() => {
                        if (notification.close) notification.close();
                        notification.remove();
                        this._updateCloseAllButton();
                    }, this._animationDuration);
                });
            }
        }, 

        _updateCloseAllButton: function() {
            if (!this.container) return;
            const prefix = this.config.cssPrefix;
            const notifications = this.container.querySelectorAll(`.${prefix}__el`);
            const closeAllBtn = this.container.querySelector(`.${prefix}__close-all`);
        
            const showCloseAll = this.config.showCloseAllButton;
            const closeAllThreshold = this.config.closeAllThreshold;
            
            if (!showCloseAll) {
                if (closeAllBtn) {
                    closeAllBtn.remove();
                }
                return;
            }
            
            const shouldShow = notifications.length >= closeAllThreshold;
            
            if (shouldShow && !closeAllBtn) {
                const btn = document.createElement('button');
                btn.className = `${prefix}__close-all`;
                btn.type = 'button';
                btn.innerHTML = this.config.lexicon.closeAll;
                Constructor._setData(btn, 'animation-open', this.config.animationOpen, QU_PREFIX);
                Constructor._setData(btn, 'animation-close', this.config.animationClose, QU_PREFIX);
                btn.style.setProperty('--qu-transition-duration', `${this.config.animationDuration}ms`);
                
                setTimeout(() => {
                    btn.classList.add(`${prefix}__close-all--visible`);
                }, 10);
        
                Constructor._Qu.on('click', btn, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const duration = this.config.animationDuration;
                    
                    this.container.querySelectorAll(`.${prefix}__el`).forEach(el => {
                        Constructor._removeData(el, 'opening', QU_PREFIX);
                        Constructor._setData(el, 'closing', '', QU_PREFIX);
                        setTimeout(() => {
                            if (el.close) el.close();
                            el.remove();
                        }, this._animationDuration);
                    });
                    
                    btn.classList.add('notifyer__close-all--removeing');
                    setTimeout(() => {
                        if (btn.parentElement) {
                            btn.remove();
                        }
                    }, duration);
                });
                
                this.container.appendChild(btn);
                btn.title = btn.textContent; 
                btn.setAttribute('aria-label', btn.textContent);
                
            } else if (!shouldShow && closeAllBtn) {
                Constructor._removeData(closeAllBtn, 'opening', QU_PREFIX);
                Constructor._setData(closeAllBtn, 'closing', '', QU_PREFIX);
                closeAllBtn.classList.remove(`${prefix}__close-all--visible`);
                setTimeout(() => {
                    if (closeAllBtn.parentElement) {
                        closeAllBtn.remove();
                    }
                }, this._animationDuration);
            }
        },

        showNotification: function() {
            if (!this.$el) return;
            
            this.$el.show();
            
            requestAnimationFrame(() => {
                Constructor._setData(this.$el, 'opening', '', QU_PREFIX);
            });

            if (this.config.autohide) {
                setTimeout(() => {
                    this.hide();
                }, this.config.timeout);
            }
        },

        hide: function() {
            if (!this.$el) return;
            
            Constructor._removeData(this.$el, 'opening', QU_PREFIX);
            Constructor._setData(this.$el, 'closing', '', QU_PREFIX);
            
            setTimeout(() => {
                if (this.$el.parentElement) {
                    this.$el.remove();
                }
                this.$el = null;
                
                if (this.container) {
                    this._updateCloseAllButton();
                }
            }, this._animationDuration);
        },

        setAnimation: function(animationOpen, animationClose = null) {
            if (!this.$el) return this;
            
            Constructor._setData(this.$el, 'animation-open', animationOpen, QU_PREFIX);
            Constructor._setData(this.$el, 'animation-close', animationClose || animationOpen, QU_PREFIX);
            
            return this;
        },

        getAnimation: function() {
            if (!this.$el) return null;
            
            return {
                open: Constructor._getData(this.$el, 'animation-open', QU_PREFIX),
                close: Constructor._getData(this.$el, 'animation-close', QU_PREFIX)
            };
        }
    };


    if (window.Qu) {
        window.Qu.lib(LIB_NAME, Constructor);
    } else {
        window._QuLibs = window._QuLibs || [];
        window._QuLibs.push({ name: LIB_NAME, instance: Constructor });
    }

})(window, document);