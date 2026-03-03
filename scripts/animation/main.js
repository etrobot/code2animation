// Main animation system entry point - Support for fadein, fadeout, spin
import { AnimationCore } from './core.js';
import { interpolate } from './interpolation.js';
import { FrameAnimationManager } from './frame-animations.js';

(function() {
  console.log('[DeterministicIframe] Initializing simple animation system...');
  
  // Create core instances
  const core = new AnimationCore();
  const frameAnimationManager = new FrameAnimationManager(core);
  
  // Expose global functions
  window.interpolate = interpolate;
  window.registerFrameAnimation = frameAnimationManager.registerFrameAnimation.bind(frameAnimationManager);
  window.removeFrameAnimation = frameAnimationManager.removeFrameAnimation.bind(frameAnimationManager);
  window.frameAnimationManager = frameAnimationManager;
  
  // Animation helper functions
  window.fadeIn = (element, duration = 1) => {
    element.style.opacity = '0';
    return frameAnimationManager.registerFrameAnimation(element, (frame, elapsed) => {
      const progress = Math.min(elapsed / duration, 1);
      element.style.opacity = progress;
    }, duration);
  };
  
  window.fadeOut = (element, duration = 1) => {
    const startOpacity = parseFloat(element.style.opacity) || 1;
    return frameAnimationManager.registerFrameAnimation(element, (frame, elapsed) => {
      const progress = Math.min(elapsed / duration, 1);
      element.style.opacity = startOpacity * (1 - progress);
    }, duration);
  };
  
  window.spin = (element, speed = 1) => {
    return frameAnimationManager.registerFrameAnimation(element, (frame, elapsed) => {
      const rotation = (elapsed * 360 * speed) % 360;
      element.style.transform = `rotate(${rotation}deg)`;
    });
  };
  
  window.blink = (element, speed = 1) => {
    return frameAnimationManager.registerFrameAnimation(element, (frame, elapsed) => {
      const opacity = ((elapsed * speed) % 1) < 0.5 ? 1 : 0;
      element.style.opacity = opacity;
    });
  };
  
  // Sync function
  window.syncTime = (time) => {
    core.syncTime(time);
    frameAnimationManager.updateAnimations(time);
  };
  
  // Auto-detect and convert CSS animations
  function convertCSSAnimations() {
    // Convert elements with CSS animations to frame-based animations
    const animatedElements = document.querySelectorAll('*');
    animatedElements.forEach(el => {
      const computedStyle = window.getComputedStyle(el);
      const animationName = computedStyle.animationName;
      
      if (animationName && animationName !== 'none') {
        console.log(`[Animation] Converting CSS animation: ${animationName}`);
        
        // Disable CSS animation
        el.style.animation = 'none';
        
        // Convert to frame-based animation
        if (animationName.includes('blink')) {
          window.blink(el);
        } else if (animationName.includes('spin')) {
          window.spin(el);
        } else if (animationName.includes('fadeIn')) {
          window.fadeIn(el);
        } else if (animationName.includes('fadeOut')) {
          window.fadeOut(el);
        }
      }
    });
    
    // Convert cursor elements
    const cursors = document.querySelectorAll('.cursor, [id*="cursor"]');
    cursors.forEach(cursor => {
      window.blink(cursor);
    });
    
    // Convert spinner elements
    const spinners = document.querySelectorAll('.spinner');
    spinners.forEach(spinner => {
      window.spin(spinner);
    });
  }
  
  // Convert animations when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', convertCSSAnimations);
  } else {
    setTimeout(convertCSSAnimations, 100);
  }
  
  // Listen for sync messages
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'seek') {
      window.syncTime(event.data.time);
    }
  });
  
  console.log('[DeterministicIframe] Simple animation system loaded');
})();