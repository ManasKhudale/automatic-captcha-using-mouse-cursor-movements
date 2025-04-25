class ButtonInterceptor {
  constructor(botDetector) {
    this.botDetector = botDetector;
    console.log('ButtonInterceptor initialized with detector:', !!botDetector);
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Process all buttons and links when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded, setting up interceptors');
      this.interceptAllClickables();
      
      // For dynamically added elements, observe DOM changes
      const observer = new MutationObserver(() => this.interceptAllClickables());
      observer.observe(document.body, { subtree: true, childList: true });
    });
  }

  interceptAllClickables() {
    // Target all clickable elements that haven't been processed yet
    const clickables = document.querySelectorAll('a:not([data-intercepted]), button:not([data-intercepted])');
    
    console.log(`Found ${clickables.length} clickable elements to process`);
    
    clickables.forEach(element => {
      // Mark as processed
      element.setAttribute('data-intercepted', 'true');
      
      // Store original onclick if it exists
      const originalClick = element.onclick;
      
      // Replace with our interceptor
      element.addEventListener('click', async (event) => {
        // Don't intercept if it's a special link
        if (element.classList.contains('no-intercept')) {
          console.log('Skipping interception for special element');
          if (originalClick) return originalClick.call(element, event);
          return true;
        }
        
        console.log('Click intercepted, checking for bot...');
        
        // Check if bot before proceeding
        const isBot = await this.botDetector.checkIsBot();
        
        if (isBot) {
          console.log('Bot click detected - blocking action');
          event.preventDefault();
          event.stopImmediatePropagation();
          alert('Bot detected! Access denied.');
          return false;
        } else {
          console.log('Human click confirmed - allowing action');
          
          // Execute original handler if it existed
          if (originalClick) {
            const result = originalClick.call(element, event);
            if (result === false) {
              event.preventDefault();
            }
            return result;
          }
          return true; // Allow the default action
        }
      });
    });
  }
}

// Initialize when bot detector is ready
if (window.BotDetector) {
  console.log('Creating ButtonInterceptor...');
  window.ButtonInterceptor = new ButtonInterceptor(window.BotDetector);
} else {
  console.error('Bot detector not found - ButtonInterceptor cannot be created');
}