// CRITICAL: Import N3 from CDN for browser compatibility
import * as N3 from 'https://esm.sh/n3@1.17.2';
// CRITICAL: Import mntl-space-fab so it registers itself
import '@mmmlib/mntl-space-fab/src/mntl-space-fab.js';

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

class TTLEditorFormWC extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // State
    this._mmmServer = null;
    this._currentIdentity = null;
    this._defaultGraph = 'mntl:publ/imported';
    this._acceptedTypes = [...DEFAULT_ACCEPTED_TYPES];
    
    this.ttlContent = '';
    this.isValid = false;
    this.validationError = null;
    this.tripleCount = 0;
    
    this._updateTimer = null;
  }
  
  get mmmServer() { return this._mmmServer; }
  set mmmServer(value) { this._mmmServer = value; }
  
  get currentIdentity() { return this._currentIdentity; }
  set currentIdentity(value) {
    this._currentIdentity = value;
    this.updateAttribution();
    this.updateFab();
  }
  
  get defaultGraph() { return this._defaultGraph; }
  set defaultGraph(value) {
    this._defaultGraph = value;
    this.updateFab();
  }
  
  get acceptedTypes() { return this._acceptedTypes; }
  set acceptedTypes(types) {
    if (Array.isArray(types) && types.length > 0) {
      this._acceptedTypes = types;
      this.updateFab();
    }
  }
  
  connectedCallback() {
    this.render();
    this.setupFab();
    this.attachEventListeners();
    this.updateAttribution();
    
    this._updateTimer = setInterval(() => this.updateAttribution(), 1000);
  }
  
  disconnectedCallback() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
    }
  }
  
  render() {
    const identity = this._currentIdentity || 'not logged in';
    const isAuthenticated = !!this._currentIdentity;
    
    this.shadowRoot.innerHTML = `
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
          <h2 style="margin: 0; color: #343a40;">📝 Turtle Editor</h2>
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
          <mntl-space-fab id="graph-fab"></mntl-space-fab>
        </div>
        
        <div class="submit-section">
          <button type="button" class="btn btn-secondary" id="clear-btn">Clear</button>
          <button type="button" class="btn btn-primary" id="submit-btn" disabled>
            Submit Turtle
          </button>
        </div>
      </div>
    `;
  }
  
  setupFab() {
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (fab) {
      fab.currentIdentity = this._currentIdentity;
      fab.acceptedTypes = this._acceptedTypes;
      fab.value = this._defaultGraph;
      
      fab.addEventListener('graph-changed', () => {
        this.updateSubmitButton();
      });
    }
  }
  
  updateFab() {
    const fab = this.shadowRoot.getElementById('graph-fab');
    if (fab) {
      fab.currentIdentity = this._currentIdentity;
      fab.acceptedTypes = this._acceptedTypes;
      if (this._defaultGraph) {
        fab.value = this._defaultGraph;
      }
    }
  }
  
  attachEventListeners() {
    const textarea = this.shadowRoot.getElementById('ttl-input');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    
    let debounceTimer;
    textarea?.addEventListener('input', (e) => {
      this.ttlContent = e.target.value;
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.validateTTL();
        this.updateSubmitButton();
      }, 300);
    });
    
    submitBtn?.addEventListener('click', () => this.handleSubmit());
    clearBtn?.addEventListener('click', () => this.clear());
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
      const parser = new N3.Parser();
      const triples = parser.parse(this.ttlContent);
      
      this.isValid = true;
      this.validationError = null;
      this.tripleCount = triples.length;
      
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
    if (!this.isValid || !this._currentIdentity) return;
    
    const fab = this.shadowRoot.getElementById('graph-fab');
    const graph = fab.getValue();
    const at = new Date().toISOString();
    const by = this._currentIdentity;
    
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
      
      this.dispatchEvent(new CustomEvent('ttl-submitted', {
        detail: { ttl: this.ttlContent, graph, at, by, tripleCount: this.tripleCount },
        bubbles: true,
        composed: true
      }));
      
      this.clear();
      
    } catch (error) {
      console.error('❌ TTL submission failed:', error);
      
      this.dispatchEvent(new CustomEvent('ttl-error', {
        detail: { error },
        bubbles: true,
        composed: true
      }));
      
      alert(`Failed to submit Turtle:\n${error.message}`);
    }
  }
  
  clear() {
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
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('ttl-editor-form', TTLEditorFormWC);

export { TTLEditorFormWC };
