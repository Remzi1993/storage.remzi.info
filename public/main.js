class DirectoryRenderer {
  #FILE_ICON_MAP = {
    'folder': 'fa-regular fa-folder',
    'pdf': 'fa-regular fa-file-pdf',
    'image': 'fa-regular fa-file-image',
    'word': 'fa-regular fa-file-word',
    'excel': 'fa-regular fa-file-excel',
    'csv': 'fa-regular fa-file-csv',
    'js': 'bi bi-filetype-js',
    'json': 'bi bi-filetype-json',
    'html': 'bi bi-filetype-html',
    'css': 'bi bi-filetype-css',
    'sass': 'bi bi-filetype-sass',
    'scss': 'bi bi-filetype-scss',
    'xml': 'bi bi-filetype-xml',
    'ppt': 'bi bi-filetype-ppt',
    'pptx': 'bi bi-filetype-pptx',
    'archive': 'bi bi-file-zip',
    'default': 'fa-regular fa-file'
  };

  #EXTENSION_TO_TYPE_MAP = {
    'zip': 'archive',
    'rar': 'archive',
    'tar': 'archive',
    '7z': 'archive',
    'pdf': 'pdf',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'doc': 'word',
    'docx': 'word',
    'xls': 'excel',
    'xlsx': 'excel',
    'csv': 'csv',
    'js': 'js',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'sass': 'sass',
    'scss': 'scss',
    'xml': 'xml',
    'ppt': 'ppt',
    'pptx': 'pptx'
  };

  constructor(containerSelector, JSON_URL) {
    this.container = document.querySelector(containerSelector);
    this.JSON_URL = JSON_URL;
  }

  async #fetchJSON() {
    const response = await fetch(this.JSON_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  #getFileExtension(filename) {
    const match = filename.match(/\.\w*$/);
    return match ? match[0].slice(1).toLowerCase() : null;
  }

  #getFileType(filename) {
    const extension = this.#getFileExtension(filename);
    return this.#EXTENSION_TO_TYPE_MAP[extension] || 'default';
  }

  #getFileIconClass(filename) {
    const type = this.#getFileType(filename);
    return this.#FILE_ICON_MAP[type] || this.#FILE_ICON_MAP.default;
  }

  #generateFolderHTML({name, children}) {
    const cssClass = this.#FILE_ICON_MAP['folder'];
    const childrenHTML = children && children.length ? `
      <li class="list-group-item">
        <ul class="list-group">
          ${children.map(child => this.#generateHTML(child)).join('')}
        </ul>
      </li>` : '';

    return `
      <li class="list-group-item"><i class="${cssClass}"></i> ${name}</li>
      ${childrenHTML}
    `;
  }

  #generateFileHTML({path, name}) {
    const cssClass = this.#getFileIconClass(name);  // Determine icon class based on the file's name

    return `
      <li class="list-group-item">
        <i class="${cssClass}"></i> 
        <a href="${path}">${name}</a>
      </li>`;
  }

  #generateHTML(item) {
    return item.path ? this.#generateFileHTML(item) : this.#generateFolderHTML(item);
  }

  #renderDirectories(directories) {
    this.container.innerHTML = `
      <ul class="list-group">
        ${directories.map(dir => this.#generateHTML(dir)).join('')}
      </ul>`;
  }

  #displayError(message) {
    this.container.innerHTML = `<div class="error">${message}</div>`;
  }

  async render() {
    try {
      const data = await this.#fetchJSON();
      this.#renderDirectories(data);
    } catch (error) {
      console.error('Failed to fetch JSON file.', error);
      this.#displayError(`
        <div class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle"></i> Cannot display the directory listing due to an error.
        </div>
      `);
    }
  }
}

const directoryRenderer = new DirectoryRenderer('#directory-container', 'directory-structure.json');
directoryRenderer.render().then();