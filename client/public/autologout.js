(function() {
  'use strict';

  try {
    // PREVENT DUPLICATION: Check if already initialized
    if (window.AutoLogout || document.body.getAttribute('data-autologout-initialized') === 'true') {
      return;
    }

    // PREVENT EDGE CASES: Check if current page is login page to avoid redirect loops
    var isLoginPage = function() {
      var pathname = window.location.pathname;
      return pathname === '/auth' || 
             pathname === '/login' || 
             pathname.includes('auth') ||
             pathname.includes('login') ||
             document.querySelector('form[action*="login"]') ||
             document.querySelector('input[name="email"][type="email"]');
    };

    // CONFIGURATION: Get timeout from data attribute or default to 30 minutes
    var getTimeoutMinutes = function() {
      try {
        var dataTimeout = document.body.getAttribute('data-timeout-minutes');
        var minutes = dataTimeout ? parseInt(dataTimeout, 10) : 30;
        return isNaN(minutes) || minutes <= 0 ? 30 : minutes;
      } catch (e) {
        return 30;
      }
    };

    // CORE FUNCTIONALITY: Auto-logout system
    var AutoLogoutSystem = {
      timerId: null,
      timeoutMinutes: getTimeoutMinutes(),
      timeoutMs: null,
      lastActivity: Date.now(),
      throttleTimeMs: 1000, // Throttle activity detection to max 1 per second
      isThrottling: false,
      cleanupFunctions: [],
      
      // FEATURE DETECTION: Check if APIs exist
      hasLocalStorage: function() {
        try {
          var test = '__autologout_test__';
          window.localStorage.setItem(test, test);
          window.localStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      },

      hasSessionStorage: function() {
        try {
          var test = '__autologout_test__';
          window.sessionStorage.setItem(test, test);
          window.sessionStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      },

      // PREVENT PERFORMANCE ISSUES: Throttled activity detection
      resetTimer: function() {
        if (this.isThrottling) {
          return;
        }
        
        this.isThrottling = true;
        var self = this;
        
        setTimeout(function() {
          self.isThrottling = false;
        }, this.throttleTimeMs);

        this.lastActivity = Date.now();
        
        if (this.timerId) {
          clearTimeout(this.timerId);
        }
        
        this.timerId = setTimeout(function() {
          self.logout();
        }, this.timeoutMs);
      },

      // LOGOUT FUNCTIONALITY: Clear storage and redirect
      logout: function() {
        try {
          // Clear storage if available
          if (this.hasLocalStorage()) {
            try {
              window.localStorage.clear();
            } catch (e) {
              // Silently fail in incognito mode
            }
          }
          
          if (this.hasSessionStorage()) {
            try {
              window.sessionStorage.clear();
            } catch (e) {
              // Silently fail in incognito mode
            }
          }

          // Cleanup before redirect
          this.cleanup();
          
          // PREVENT EDGE CASES: Handle redirect carefully
          this.redirectToLogin();
          
        } catch (e) {
          // Fallback: reload page if redirect fails
          this.fallbackReload();
        }
      },

      // PREVENT EDGE CASES: Smart redirect with fallbacks
      redirectToLogin: function() {
        var loginPaths = ['/auth', '/login'];
        var currentPath = window.location.pathname;
        
        // Don't redirect if already on login page
        if (isLoginPage()) {
          return;
        }

        // Try each login path
        for (var i = 0; i < loginPaths.length; i++) {
          try {
            window.location.href = loginPaths[i];
            return;
          } catch (e) {
            continue;
          }
        }
        
        // Fallback: reload current page
        this.fallbackReload();
      },

      // PREVENT EDGE CASES: Fallback to reload if redirect fails
      fallbackReload: function() {
        try {
          window.location.reload();
        } catch (e) {
          // Last resort: try to redirect to root
          try {
            window.location.href = '/';
          } catch (e2) {
            // Silent fail - browser will handle it
          }
        }
      },

      // PREVENT MEMORY LEAKS: Remove all event listeners and clear timers
      cleanup: function() {
        if (this.timerId) {
          clearTimeout(this.timerId);
          this.timerId = null;
        }

        // Execute all cleanup functions
        for (var i = 0; i < this.cleanupFunctions.length; i++) {
          try {
            this.cleanupFunctions[i]();
          } catch (e) {
            // Silent fail for cleanup functions
          }
        }
        this.cleanupFunctions = [];
      },

      // PREVENT MEMORY LEAKS: Add event listeners with cleanup tracking
      addEventListener: function(element, event, handler, options) {
        try {
          element.addEventListener(event, handler, options);
          
          // Store cleanup function
          this.cleanupFunctions.push(function() {
            try {
              element.removeEventListener(event, handler, options);
            } catch (e) {
              // Silent fail
            }
          });
        } catch (e) {
          // Feature not supported
        }
      },

      // PREVENT MULTIPLE TABS CONFLICTS: Handle storage events (basic implementation)
      handleStorageEvent: function(e) {
        // If another tab logged out, this tab should also logout
        if (e.key === '__autologout_trigger__' && e.newValue === 'logout') {
          this.logout();
        }
      },

      // PREVENT MULTIPLE TABS CONFLICTS: Broadcast logout to other tabs
      broadcastLogout: function() {
        if (this.hasLocalStorage()) {
          try {
            window.localStorage.setItem('__autologout_trigger__', 'logout');
            // Clean up the trigger immediately
            setTimeout(function() {
              try {
                window.localStorage.removeItem('__autologout_trigger__');
              } catch (e) {
                // Silent fail
              }
            }, 100);
          } catch (e) {
            // Silent fail in incognito mode
          }
        }
      },

      // INITIALIZATION: Set up all event listeners and timers
      init: function() {
        // Don't initialize on login page
        if (isLoginPage()) {
          return;
        }

        this.timeoutMs = this.timeoutMinutes * 60 * 1000;
        var self = this;

        // Activity events that reset the timer
        var activityEvents = ['click', 'keypress', 'scroll', 'touchstart', 'mousemove'];
        
        for (var i = 0; i < activityEvents.length; i++) {
          this.addEventListener(
            document, 
            activityEvents[i], 
            function() { self.resetTimer(); },
            { passive: true } // PREVENT PERFORMANCE ISSUES: Use passive listeners
          );
        }

        // PREVENT MULTIPLE TABS CONFLICTS: Listen for storage events
        if (window.addEventListener && this.hasLocalStorage()) {
          this.addEventListener(window, 'storage', function(e) {
            self.handleStorageEvent(e);
          });
        }

        // PREVENT MEMORY LEAKS: Cleanup on page unload
        this.addEventListener(window, 'beforeunload', function() {
          self.cleanup();
        });

        this.addEventListener(window, 'unload', function() {
          self.cleanup();
        });

        // Start the timer
        this.resetTimer();

        // PREVENT DUPLICATION: Mark as initialized
        document.body.setAttribute('data-autologout-initialized', 'true');
        
        return true;
      }
    };

    // PREVENT BREAKING EXISTING CODE: Expose minimal API safely
    window.AutoLogout = {
      // Public API for manual logout (can be called by existing logout code)
      logout: function() {
        AutoLogoutSystem.broadcastLogout();
        AutoLogoutSystem.logout();
      },
      
      // Public API to reset/extend the timer
      resetTimer: function() {
        AutoLogoutSystem.resetTimer();
      },
      
      // Public API to cleanup (useful for SPAs during navigation)
      cleanup: function() {
        AutoLogoutSystem.cleanup();
        document.body.removeAttribute('data-autologout-initialized');
        window.AutoLogout = undefined;
      },

      // Public API to check if initialized
      isInitialized: function() {
        return document.body.getAttribute('data-autologout-initialized') === 'true';
      }
    };

    // INITIALIZATION: Start when DOM is ready or immediately if already ready
    var initialize = function() {
      try {
        return AutoLogoutSystem.init();
      } catch (e) {
        // Silent fail - don't break the page
        return false;
      }
    };

    // SINGLE INITIALIZATION: Handle different ready states
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      // DOM already ready
      initialize();
    }

  } catch (globalError) {
    // PREVENT BREAKING EXISTING CODE: Silently fail if anything goes wrong
    // Don't expose the error to avoid breaking the page
  }
})();