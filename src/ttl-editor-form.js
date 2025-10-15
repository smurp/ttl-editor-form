// CRITICAL: Import N3 from CDN for browser compatibility
console.log('🔧 [TTL-EDITOR] Starting module...');
import * as N3 from 'https://esm.sh/n3@1.17.2';
console.log('✅ [TTL-EDITOR] N3 imported:', !!N3);

// NO STATIC IMPORT of mntl-space-fab - we'll load it dynamically
console.log('🔧 [TTL-EDITOR] Will load mntl-space-fab dynamically when needed');

// Default accepted types (only open and publ for security)
const DEFAULT_ACCEPTED_TYPES = [
  { 
    value: 'mntl:open', 
    label: 'mntl:open/{identity}',
    description: 'mntl:open - Owned by you, readable by the world' 
  },
  { 
    value: 'mntl:publ', 
    label: 'mntl:publ',
    description: 'mntl:publ - A true public commons' 
  }
];

console.log('🔧 [TTL-EDITOR] Defining component class...');

class TTLEditorFormWC extends HTMLElement {
  constructor() {
    super();
    console.log('🏗️ [TTL-EDITOR] Constructor called');
    this.attachShadow({ mode: 'open' });
    console.log('✅ [TTL-EDITOR] Shadow DOM attached');
    
    // State
    this._mmmServer = null;
    this._currentIdentity = null;
    this._defaultGraph = 'mntl:publ/imported';
    this._acceptedTypes = [...DEFAULT_ACCEPTED_TYPES];
    this._mntlSpaceFabLoaded = false;
    
    this.ttlContent = '';
    this.isValid = false;
    this.validationError = null;
    this.tripleCount = 0;
    
    this._updateTimer = null;
    console.log('✅ [TTL-EDITOR] State initialized');
  }
  
  get mmmServer() { return this._mmmServer; }
  set mmmServer(value) { this._mmmServer = value; }
  
  get currentIdentity() { return this._currentIdentity; }
  set currentIdentity(value) {
    console.log('🔧 [TTL-EDITOR] Setting currentIdentity:', value);
    this._currentIdentity = value;
    this.updateAttribution();
    this.updateFab();
  }
  
  get defaultGraph() { return this._defaultGraph; }
  set defaultGraph(value) {
    console.log('🔧 [TTL-EDITOR] Setting defaultGraph:', value);
    this._defaultGraph = value;
    this.updateFab();
  }
  
  get acceptedTypes() { return this._acceptedTypes; }
  set acceptedTypes(types) {
    if (Array.isArray(types) && types.length > 0) {
      console.log('🔧 [TTL-EDITOR] Setting acceptedTypes:', types.length, 'types');
      this._acceptedTypes = types;
      this.updateFab();
    }
  }
  
  async connectedCallback() {
    console.log('🔌 [TTL-EDITOR] connectedCallback - component added to DOM');
    
    try {
      // CRITICAL: Load mntl-space-fab dynamically (matching quad-form pattern)
      await this.loadMntlSpaceFab();
      
      console.log('🎨 [TTL-EDITOR] Calling render()...');
      this.render();
      console.log('✅ [TTL-EDITOR] render() completed');
      
      console.log('🎛️ [TTL-EDITOR] Calling setupFab()...');
      this.setupFab();
      console.log('✅ [TTL-EDITOR] setupFab() completed');
      
      console.log('🔗 [TTL-EDITOR] Calling attachEventListeners()...');
      this.attachEventListeners();
      console.log('✅ [TTL-EDITOR] attachEventListeners() completed');
      
      console.log('⏰ [TTL-EDITOR] Calling updateAttribution()...');
      this.updateAttribution();
      console.log('✅ [TTL-EDITOR] updateAttribution() completed');
      
      this._updateTimer = setInterval(() => this.updateAttribution(), 1000);
      console.log('✅ [TTL-EDITOR] Update timer started');
    } catch (error) {
      console.error('❌ [TTL-EDITOR] Error in connectedCallback:', error);
    }
  }
  
  async loadMntlSpaceFab() {
    console.log('📦 [TTL-EDITOR] loadMntlSpaceFab() starting...');
    
    // Check if already loaded
    if (customElements.get('mntl-space-fab')) {
      console.log('✅ [TTL-EDITOR] mntl-space-fab already registered');
      this._mntlSpaceFabLoaded = true;
      return;
    }
    
    // Try to dynamically load it from the server route
    try {
      console.log('🔄 [TTL-EDITOR] Attempting to load mntl-space-fab from /mntl-space-fab/src/mntl-space-fab.js');
      await import('/mntl-space-fab/src/mntl-space-fab.js');
      console.log('✅ [TTL-EDITOR] Successfully loaded mntl-space-fab');
      this._mntlSpaceFabLoaded = true;
    } catch (err) {
      console.error('❌ [TTL-EDITOR] Failed to load mntl-space-fab:', err);
      console.warn('⚠️ [TTL-EDITOR] Will show error message to user');
      this._mntlSpaceFabLoaded = false;
      // Don't throw - we'll show a fallback UI
    }
  }
  
  disconnectedCallback() {
    console.log('🔌 [TTL-EDITOR] disconnectedCallback - component removed from DOM');
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
    }
  }
  
  render() {
    console.log('🎨 [TTL-EDITOR] render() starting...');
    const identity = this._currentIdentity || 'not logged in';
    const isAuthenticated = !!this._currentIdentity;
    console.log('🎨 [TTL-EDITOR] identity:', identity, 'isAuthenticated:', isAuthenticated);
    
    const html = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .form-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
        
        .attribution {
          display: flex;
          gap: 30px;
          font-size: 14px;
        }
        
        .attr-item {
          display: flex;
          gap: 8px;
        }
        
        .attr-label {
          font-weight: 600;
          color: #6c757d;
        }
        
        .attr-value {
          font-family: 'Monaco', monospace;
          color: ${isAuthenticated ? '#28a745' : '#dc3545'};
          font-weight: 500;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .section-label {
          display: block;
          font-weight: 600;
          margin-bottom: 10px;
          color: #495057;
          font-size: 15px;
        }
        
        .ttl-textarea {
          width: 100%;
          min-height: 400px;
          padding: 15px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          border: 2px solid #ced4da;
          border-radius: 6px;
          resize: vertical;
          box-sizing: border-box;
          background: #ffffff;
          display: block;
        }
        
        .ttl-textarea:focus {
          outline: none;
          border-color: #80bdff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        
        .ttl-textarea.invalid {
          border-color: #dc3545;
          background: #fff5f5;
        }
        
        .ttl-textarea.valid {
          border-color: #28a745;
        }
        
        .validation-status {
          margin-top: 10px;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        
        .validation-status.valid {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }
        
        .validation-status.invalid {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }
        
        .validation-status.empty {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
        }
        
        .error-message {
          font-family: 'Monaco', monospace;
          font-size: 12px;
          margin-top: 8px;
          white-space: pre-wrap;
        }
        
        .component-error {
          background: #f8d7da;
          border: 2px solid #f5c6cb;
          color: #721c24;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .submit-section {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        
        .btn {
          padding: 12px 30px;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: #007bff;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #545b62;
        }
      </style>
      
      <div class="form-container">
        <div class="header">
          <h2 style="margin: 0; color: #343a40;">Ͳ Turtle Editor</h2>
          <div class="attribution">
            <div class="attr-item">
              <span class="attr-label">at:</span>
              <span class="attr-value" id="at-value">--</span>
            </div>
            <div class="attr-item">
              <span class="attr-label">by:</span>
              <span class="attr-value" id="by-value">${identity}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <label class="section-label">Turtle (TTL) Content</label>
          <textarea 
            class="ttl-textarea" 
            id="ttl-input"
            placeholder="@prefix ex: <http://example.org/> .

ex:Alice ex:knows ex:Bob .
ex:Bob ex:age 42 .
ex:Charlie a ex:Person ;
    ex:name &quot;Charlie&quot;@en ."
            spellcheck="false"
          ></textarea>
          <div id="validation-status" class="validation-status empty">
            ⚠️ Enter some Turtle content to begin
          </div>
        </div>
        
        <div class="section">
          <label class="section-label">Target Graph</label>
          ${this._mntlSpaceFabLoaded 
            ? '<mntl-space-fab id="graph-fab"></mntl-space-fab>'
            : `<div class="component-error">
                 ❌ Failed to load mntl-space-fab component.<br>
                 <small>Check that the MMM server is running and /mntl-space-fab/ route is registered.</small>
               </div>`
          }
        </div>
        
        <div class="submit-section">
          <button type="button" class="btn btn-secondary" id="clear-btn">Clear</button>
          <button type="button" class="btn btn-primary" id="submit-btn" disabled>
            Submit Turtle
          </button>
        </div>
      </div>
    `;
    
    console.log('🎨 [TTL-EDITOR] Setting shadowRoot.innerHTML (length:', html.length, ')');
    this.shadowRoot.innerHTML = html;
    console.log('✅ [TTL-EDITOR] shadowRoot.innerHTML set');
    
    // Verify elements exist
    const container = this.shadowRoot.querySelector('.form-container');
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const fab = this.shadowRoot.getElementById('graph-fab');
    console.log('🔍 [TTL-EDITOR] Elements check:');
    console.log('  - .form-container:', !!container);
    console.log('  - #ttl-input:', !!textarea);
    console.log('  - #graph-fab:', !!fab);
  }
  
  setupFab() {
    console.log('🎛️ [TTL-EDITOR] setupFab() starting...');
    
    if (!this._mntlSpaceFabLoaded) {
      console.warn('⚠️ [TTL-EDITOR] Skipping fab setup - component not loaded');
      return;
    }
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    console.log('🎛️ [TTL-EDITOR] fab element:', !!fab);
    
    if (fab) {
      console.log('🎛️ [TTL-EDITOR] Setting fab properties...');
      fab.currentIdentity = this._currentIdentity;
      console.log('  - currentIdentity set:', this._currentIdentity);
      
      fab.acceptedTypes = this._acceptedTypes;
      console.log('  - acceptedTypes set:', this._acceptedTypes.length, 'types');
      
      fab.value = this._defaultGraph;
      console.log('  - value set:', this._defaultGraph);
      
      fab.addEventListener('graph-changed', () => {
        console.log('📊 [TTL-EDITOR] graph-changed event received');
        this.updateSubmitButton();
      });
      console.log('  - event listener attached');
    } else {
      console.warn('⚠️ [TTL-EDITOR] fab element not found!');
    }
  }
  
  updateFab() {
    console.log('🔄 [TTL-EDITOR] updateFab() starting...');
    
    if (!this._mntlSpaceFabLoaded) {
      console.warn('⚠️ [TTL-EDITOR] Skipping fab update - component not loaded');
      return;
    }
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (fab) {
      fab.currentIdentity = this._currentIdentity;
      fab.acceptedTypes = this._acceptedTypes;
      if (this._defaultGraph) {
        fab.value = this._defaultGraph;
      }
      console.log('✅ [TTL-EDITOR] fab updated');
    } else {
      console.warn('⚠️ [TTL-EDITOR] fab element not found in updateFab');
    }
  }
  
  attachEventListeners() {
    console.log('🔗 [TTL-EDITOR] attachEventListeners() starting...');
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    
    console.log('🔗 [TTL-EDITOR] Elements:');
    console.log('  - textarea:', !!textarea);
    console.log('  - submitBtn:', !!submitBtn);
    console.log('  - clearBtn:', !!clearBtn);
    
    let debounceTimer;
    textarea?.addEventListener('input', (e) => {
      console.log('✏️ [TTL-EDITOR] textarea input event');
      this.ttlContent = e.target.value;
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🔍 [TTL-EDITOR] Validating TTL...');
        this.validateTTL();
        this.updateSubmitButton();
      }, 300);
    });
    
    submitBtn?.addEventListener('click', () => {
      console.log('🚀 [TTL-EDITOR] Submit button clicked');
      this.handleSubmit();
    });
    
    clearBtn?.addEventListener('click', () => {
      console.log('🗑️ [TTL-EDITOR] Clear button clicked');
      this.clear();
    });
    
    console.log('✅ [TTL-EDITOR] Event listeners attached');
  }
  
  validateTTL() {
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const statusDiv = this.shadowRoot.getElementById('validation-status');
    
    if (!this.ttlContent.trim()) {
      this.isValid = false;
      this.validationError = null;
      this.tripleCount = 0;
      
      textarea?.classList.remove('valid', 'invalid');
      if (statusDiv) {
        statusDiv.className = 'validation-status empty';
        statusDiv.innerHTML = '⚠️ Enter some Turtle content to begin';
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: false, error: 'Empty content' },
        bubbles: true,
        composed: true
      }));
      return;
    }
    
    try {
      console.log('🔍 [TTL-EDITOR] Parsing TTL with N3...');
      const parser = new N3.Parser();
      const triples = parser.parse(this.ttlContent);
      
      this.isValid = true;
      this.validationError = null;
      this.tripleCount = triples.length;
      console.log('✅ [TTL-EDITOR] Valid TTL:', this.tripleCount, 'triples');
      
      textarea?.classList.remove('invalid');
      textarea?.classList.add('valid');
      
      if (statusDiv) {
        statusDiv.className = 'validation-status valid';
        statusDiv.innerHTML = `✅ Valid Turtle - ${this.tripleCount} triple${this.tripleCount !== 1 ? 's' : ''}`;
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: true, tripleCount: this.tripleCount },
        bubbles: true,
        composed: true
      }));
      
    } catch (error) {
      console.error('❌ [TTL-EDITOR] Parse error:', error);
      this.isValid = false;
      this.validationError = error.message;
      this.tripleCount = 0;
      
      textarea?.classList.remove('valid');
      textarea?.classList.add('invalid');
      
      if (statusDiv) {
        statusDiv.className = 'validation-status invalid';
        statusDiv.innerHTML = `
          ❌ Parse Error
          <div class="error-message">${this.escapeHtml(error.message)}</div>
        `;
      }
      
      this.dispatchEvent(new CustomEvent('validation-changed', {
        detail: { valid: false, error: error.message },
        bubbles: true,
        composed: true
      }));
    }
  }
  
  updateSubmitButton() {
    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    
    if (!this._mntlSpaceFabLoaded) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'Cannot submit - mntl-space-fab component not loaded';
      }
      return;
    }
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (!submitBtn || !fab) return;
    
    const isAuthenticated = !!this._currentIdentity;
    const hasValidGraph = fab.getValue() && fab.getValue().trim().length > 0;
    
    const canSubmit = this.isValid && hasValidGraph && isAuthenticated;
    submitBtn.disabled = !canSubmit;
    
    if (!isAuthenticated) {
      submitBtn.title = 'Not authenticated - login required';
    } else if (!this.isValid) {
      submitBtn.title = 'TTL content is invalid';
    } else if (!hasValidGraph) {
      submitBtn.title = 'Graph path is required';
    } else {
      submitBtn.title = `Submit ${this.tripleCount} triple${this.tripleCount !== 1 ? 's' : ''}`;
    }
  }
  
  updateAttribution() {
    const atValue = this.shadowRoot.getElementById('at-value');
    const byValue = this.shadowRoot.getElementById('by-value');
    
    if (atValue) {
      atValue.textContent = new Date().toISOString();
    }
    
    if (byValue) {
      byValue.textContent = this._currentIdentity || 'not logged in';
      byValue.style.color = this._currentIdentity ? '#28a745' : '#dc3545';
    }
  }
  
  async handleSubmit() {
    console.log('🚀 [TTL-EDITOR] handleSubmit() starting...');
    if (!this.isValid || !this._currentIdentity || !this._mntlSpaceFabLoaded) return;
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    const graph = fab.getValue();
    const at = new Date().toISOString();
    const by = this._currentIdentity;
    
    console.log('📦 [TTL-EDITOR] Submitting:', { graph, by, tripleCount: this.tripleCount });
    
    try {
      if (this._mmmServer) {
        await this._mmmServer.ingestTurtle(this.ttlContent, graph, by);
      } else {
        const response = await fetch('/mmm/api/ingest-ttl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            ttl: this.ttlContent,
            graph,
            by
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }
      
      console.log('✅ [TTL-EDITOR] Submission successful');
      this.dispatchEvent(new CustomEvent('ttl-submitted', {
        detail: { ttl: this.ttlContent, graph, at, by, tripleCount: this.tripleCount },
        bubbles: true,
        composed: true
      }));
      
      this.clear();
      
    } catch (error) {
      console.error('❌ [TTL-EDITOR] Submission failed:', error);
      
      this.dispatchEvent(new CustomEvent('ttl-error', {
        detail: { error },
        bubbles: true,
        composed: true
      }));
      
      alert(`Failed to submit Turtle:\n${error.message}`);
    }
  }
  
  clear() {
    console.log('🗑️ [TTL-EDITOR] Clearing form...');
    this.ttlContent = '';
    this.isValid = false;
    this.validationError = null;
    this.tripleCount = 0;
    
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const statusDiv = this.shadowRoot.getElementById('validation-status');
    
    if (textarea) {
      textarea.value = '';
      textarea.classList.remove('valid', 'invalid');
    }
    
    if (statusDiv) {
      statusDiv.className = 'validation-status empty';
      statusDiv.innerHTML = '⚠️ Enter some Turtle content to begin';
    }
    
    this.updateSubmitButton();
    console.log('✅ [TTL-EDITOR] Form cleared');
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

console.log('📝 [TTL-EDITOR] Registering custom element...');
customElements.define('ttl-editor-form', TTLEditorFormWC);
console.log('✅ [TTL-EDITOR] Custom element registered as ttl-editor-form');

export { TTLEditorFormWC };
