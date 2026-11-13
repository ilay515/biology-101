/**
 * Biology: A Global Approach (11th Edition) — Chapter Reader Application
 * Apple-inspired pure frontend static reader for GitHub Pages
 */

(function () {
  'use strict';

  // Application State
  const state = {
    bookData: null,
    sections: [],
    chapters: [],
    currentChapterIndex: 0,
    currentChapter: null,
    pdfDoc: null,
    currentPageNum: 1,
    totalPages: 1,
    zoomLevel: 1.0,
    viewerMode: 'canvas', // 'canvas' | 'native'
    activeFilter: 'all',
    searchQuery: '',
    renderedPages: new Set(),
    isRendering: false,
    observer: null,
    isProgrammaticScroll: false,
    programmaticScrollTimer: null
  };

  // DOM Elements Cache
  const elements = {
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    chapterSearch: document.getElementById('chapterSearch'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    searchStats: document.getElementById('searchStats'),
    navTree: document.getElementById('navTree'),
    filterPills: document.querySelectorAll('.filter-pill'),
    sidebarDownloadUnitBtn: document.getElementById('sidebarDownloadUnitBtn'),
    sidebarDownloadUnitText: document.getElementById('sidebarDownloadUnitText'),
    
    // Toolbar elements
    currentUnitTag: document.getElementById('currentUnitTag'),
    currentChapterTitle: document.getElementById('currentChapterTitle'),
    prevChapterBtn: document.getElementById('prevChapterBtn'),
    nextChapterBtn: document.getElementById('nextChapterBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageNumberInput: document.getElementById('pageNumberInput'),
    totalPagesCount: document.getElementById('totalPagesCount'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    fitWidthBtn: document.getElementById('fitWidthBtn'),
    zoomPercentText: document.getElementById('zoomPercentText'),
    downloadChapterBtn: document.getElementById('downloadChapterBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),

    // Viewport elements
    readerViewport: document.getElementById('readerViewport'),
    chapterHeaderCard: document.getElementById('chapterHeaderCard'),
    cardUnitBadge: document.getElementById('cardUnitBadge'),
    cardPagesBadge: document.getElementById('cardPagesBadge'),
    cardSizeBadge: document.getElementById('cardSizeBadge'),
    cardTitle: document.getElementById('cardChapterTitle'),
    cardSummary: document.getElementById('cardChapterSummary'),
    cardConceptsList: document.getElementById('cardConceptsList'),
    canvasViewerContainer: document.getElementById('canvasViewerContainer'),
    pagesList: document.getElementById('pagesList'),
    nativeViewerContainer: document.getElementById('nativeViewerContainer'),
    nativeIframe: document.getElementById('nativeIframe'),
    readerStatusOverlay: document.getElementById('readerStatusOverlay'),
    readerStatusText: document.getElementById('readerStatusText'),

    // Bottom Navigation
    bottomPrevBtn: document.getElementById('bottomPrevBtn'),
    bottomPrevTitle: document.getElementById('bottomPrevTitle'),
    bottomPrevSubtitle: document.getElementById('bottomPrevSubtitle'),
    bottomNextBtn: document.getElementById('bottomNextBtn'),
    bottomNextTitle: document.getElementById('bottomNextTitle'),
    bottomNextSubtitle: document.getElementById('bottomNextSubtitle'),

    // Floating indicator & Toast
    floatingPageIndicator: document.getElementById('floatingPageIndicator'),
    floatingPageText: document.getElementById('floatingPageText'),
    floatingZoomText: document.getElementById('floatingZoomText'),
    toastNotification: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage')
  };

  // Initialize PDF.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/vendor/pdf.worker.min.js';
  }

  /**
   * Main Initialization
   */
  async function init() {
    initTheme();
    setupEventListeners();
    await loadManifest();
    
    // Check URL Hash for deep linking (e.g. #ch1, #unit-02)
    const initialIndex = getInitialChapterIndex();
    selectChapter(initialIndex, false);
  }

  /**
   * Loads units.json manifest
   */
  async function loadManifest() {
    try {
      showStatus('Loading textbook catalog...');
      const response = await fetch('./units.json');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      state.bookData = data.book;
      state.sections = data.sections;

      // Extract all chapters into flat indexed list
      state.chapters = [];
      data.sections.forEach(section => {
        section.units.forEach(unit => {
          state.chapters.push({
            ...unit,
            sectionId: section.id,
            sectionTitle: section.title
          });
        });
      });

      renderNavigationTree();
      hideStatus();
    } catch (err) {
      console.warn('Could not load ./units.json, falling back to embedded manifest:', err);
      loadFallbackManifest();
    }
  }

  /**
   * Fallback manifest for local file:// previews or network restrictions
   */
  function loadFallbackManifest() {
    const fallbackChapters = [
      { id: "unit-01", chapterNumber: 1, title: "Biology and Its Themes", unitGroup: "Introduction", pdf: "./units/unit_01.pdf", pages: 25, fileSize: "13.3 MB", status: "available", summary: "Overarching themes of life, hierarchical organization, evolutionary foundations, and scientific inquiry." },
      { id: "unit-02", chapterNumber: 2, title: "Atoms and Molecules", unitGroup: "Unit 1: Chemistry in Biology", pdf: "./units/unit_02.pdf", pages: 17, fileSize: "9.2 MB", status: "available", summary: "Elements, compounds, atomic structure, isotopes, electron configuration, and chemical bonding." },
      { id: "unit-03", chapterNumber: 3, title: "The Chemistry of Water", unitGroup: "Unit 1: Chemistry in Biology", pdf: "./units/unit_03.pdf", pages: 12, fileSize: "6.7 MB", status: "available", summary: "Polar covalent bonding, hydrogen bonds, emergent properties of water, and pH regulation." },
      { id: "unit-04", chapterNumber: 4, title: "Carbon: The Basis of Molecular Diversity", unitGroup: "Unit 1: Chemistry in Biology", pdf: "./units/unit_04.pdf", pages: 10, fileSize: "4.9 MB", status: "available", summary: "Carbon tetravalence, hydrocarbon skeletons, isomers, and key biological functional groups." },
      { id: "unit-05", chapterNumber: 5, title: "Biological Macromolecules and Lipids", unitGroup: "Unit 1: Chemistry in Biology", pdf: "./units/unit_05.pdf", pages: 27, fileSize: "13.3 MB", status: "available", summary: "Carbohydrates, lipids, protein structural folding, and nucleic acid storage." },
      { id: "unit-06", chapterNumber: 6, title: "Energy and Life", unitGroup: "Unit 1: Chemistry in Biology", pdf: "./units/unit_06.pdf", pages: 21, fileSize: "11.2 MB", status: "available", summary: "Bioenergetics, thermodynamics, ATP coupling, enzyme kinetics, and metabolic regulation." },
      { id: "unit-07", chapterNumber: 7, title: "Cell Structure and Function", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_07.pdf", pages: 34, fileSize: "17.9 MB", status: "available", summary: "Eukaryotic and prokaryotic cell compartmentalization, organelles, cytoskeleton, and matrices." },
      { id: "unit-08", chapterNumber: 8, title: "Cell Membranes", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_08.pdf", pages: 18, fileSize: "9.7 MB", status: "available", summary: "Fluid mosaic model, selective permeability, passive and active transport systems." },
      { id: "unit-09", chapterNumber: 9, title: "Cellular Signaling", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_09.pdf", pages: 22, fileSize: "11.6 MB", status: "available", summary: "Receptors (GPCR, RTK), phosphorylation cascades, secondary messengers, and apoptosis." },
      { id: "unit-10", chapterNumber: 10, title: "Cell Respiration", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_10.pdf", pages: 23, fileSize: "11.8 MB", status: "available", summary: "Glycolysis, citric acid cycle, oxidative phosphorylation, and fermentation." },
      { id: "unit-11", chapterNumber: 11, title: "Photosynthetic Processes", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_11.pdf", pages: 25, fileSize: "13.0 MB", status: "available", summary: "Light reactions, photophosphorylation, Calvin cycle, and C4/CAM adaptations." },
      { id: "unit-12", chapterNumber: 12, title: "Mitosis", unitGroup: "Unit 2: Cell Biology", pdf: "./units/unit_12.pdf", pages: 19, fileSize: "10.0 MB", status: "available", summary: "Cell cycle phases, chromosome segregation machinery, and molecular checkpoints." },
      { id: "unit-13", chapterNumber: 13, title: "Sexual Life Cycles and Meiosis", unitGroup: "Unit 3: Genetics", pdf: "./units/unit_13.pdf", pages: 16, fileSize: "8.2 MB", status: "available", summary: "Meiosis I and II, crossing over, and evolutionary origins of genetic variation." },
      { id: "unit-14", chapterNumber: 14, title: "Mendelian Genetics", unitGroup: "Unit 3: Genetics", pdf: "./units/unit_14.pdf", pages: 25, fileSize: "14.1 MB", status: "available", summary: "Laws of segregation and independent assortment, complex alleles, and pedigrees." },
      { id: "unit-15", chapterNumber: 15, title: "Linkage and Chromosomes", unitGroup: "Unit 3: Genetics", pdf: "./units/unit_15.pdf", pages: 20, fileSize: "11.2 MB", status: "available", summary: "Chromosome theory, sex-linked traits, recombination mapping, and chromosomal disorders." },
      { id: "unit-16", chapterNumber: 16, title: "Nucleic Acids and Inheritance", unitGroup: "Unit 3: Genetics", pdf: "./units/unit_16.pdf", pages: 21, fileSize: "10.8 MB", status: "available", summary: "DNA double helix, semiconservative replication fork, and enzymatic repair." },
      { id: "unit-17", chapterNumber: 17, title: "Expression of Genes", unitGroup: "Unit 3: Genetics", pdf: "./units/unit_17.pdf", pages: 15, fileSize: "8.3 MB", status: "available", summary: "Central dogma, transcription, RNA splicing, ribosomal translation, and mutations." }
    ];

    state.sections = [
      { id: "intro", title: "Introduction", units: [fallbackChapters[0]] },
      { id: "unit-1", title: "Unit 1: The Role of Chemistry in Biology", units: fallbackChapters.slice(1, 6) },
      { id: "unit-2", title: "Unit 2: Cell Biology", units: fallbackChapters.slice(6, 12) },
      { id: "unit-3", title: "Unit 3: The Genetic Basis of Life", units: fallbackChapters.slice(12, 17) }
    ];

    state.chapters = fallbackChapters;
    renderNavigationTree();
    hideStatus();
  }

  /**
   * Renders the Navigation Tree in Sidebar
   */
  function renderNavigationTree() {
    const nav = elements.navTree;
    nav.innerHTML = '';

    const query = state.searchQuery.trim().toLowerCase();
    const filter = state.activeFilter;
    let matchCount = 0;

    state.sections.forEach(section => {
      // Filter units inside section
      const filteredUnits = section.units.filter(unit => {
        // Filter pill match
        if (filter !== 'all' && section.id !== filter) {
          return false;
        }

        // Search query match
        if (!query) return true;

        const titleMatch = unit.title.toLowerCase().includes(query);
        const chNumMatch = `chapter ${unit.chapterNumber}`.includes(query) || `ch ${unit.chapterNumber}`.includes(query);
        const summaryMatch = unit.summary && unit.summary.toLowerCase().includes(query);
        const conceptsMatch = unit.concepts && unit.concepts.some(c => c.toLowerCase().includes(query));

        return titleMatch || chNumMatch || summaryMatch || conceptsMatch;
      });

      if (filteredUnits.length === 0) return;

      matchCount += filteredUnits.length;

      // Create Unit Accordion Section
      const sectionEl = document.createElement('div');
      sectionEl.className = 'nav-unit-section';
      sectionEl.dataset.sectionId = section.id;

      // Unit Header
      const headerBtn = document.createElement('button');
      headerBtn.className = 'nav-unit-header';
      headerBtn.setAttribute('aria-expanded', 'true');
      headerBtn.innerHTML = `
        <div class="nav-unit-title-group">
          <span class="nav-unit-tag">${escapeHtml(section.id.toUpperCase())}</span>
          <span class="nav-unit-title">${escapeHtml(section.title)}</span>
        </div>
        <div class="nav-unit-meta">
          <span class="nav-chapter-count">${filteredUnits.length}</span>
          <svg class="unit-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      `;

      headerBtn.addEventListener('click', () => {
        const isCollapsed = sectionEl.classList.toggle('collapsed');
        headerBtn.setAttribute('aria-expanded', !isCollapsed);
      });

      // Chapter Items List
      const listEl = document.createElement('div');
      listEl.className = 'nav-chapter-list';

      filteredUnits.forEach(unit => {
        const isSelected = state.currentChapter && state.currentChapter.id === unit.id;
        const itemBtn = document.createElement('button');
        itemBtn.className = `nav-chapter-item ${isSelected ? 'active' : ''}`;
        itemBtn.dataset.chapterId = unit.id;
        
        const highlightedTitle = highlightMatch(unit.title, query);

        itemBtn.innerHTML = `
          <div class="nav-chapter-info">
            <span class="nav-chapter-number">Chapter ${unit.chapterNumber}</span>
            <span class="nav-chapter-title">${highlightedTitle}</span>
          </div>
          <div class="nav-chapter-badges">
            ${unit.status === 'upcoming' 
              ? `<span class="upcoming-badge">Soon</span>` 
              : `<span class="page-badge">${unit.pages || 20}p</span>`
            }
          </div>
        `;

        itemBtn.addEventListener('click', () => {
          const index = state.chapters.findIndex(c => c.id === unit.id);
          if (index !== -1) {
            selectChapter(index, true);
            // Close sidebar on mobile upon selection
            if (window.innerWidth <= 860) {
              closeMobileSidebar();
            }
          }
        });

        listEl.appendChild(itemBtn);
      });

      sectionEl.appendChild(headerBtn);
      sectionEl.appendChild(listEl);
      nav.appendChild(sectionEl);
    });

    // Update search stats badge
    if (query) {
      elements.searchStats.hidden = false;
      elements.searchStats.textContent = `${matchCount} chapter${matchCount === 1 ? '' : 's'} found`;
    } else {
      elements.searchStats.hidden = true;
    }
  }

  /**
   * Chapter Selection Handler
   */
  async function selectChapter(index, updateHistory = true) {
    if (index < 0 || index >= state.chapters.length) return;

    const chapter = state.chapters[index];
    state.currentChapterIndex = index;
    state.currentChapter = chapter;

    // Update URL hash without jumping page
    if (updateHistory) {
      history.replaceState(null, '', `#ch${chapter.chapterNumber}`);
      try {
        localStorage.setItem('biology_last_chapter', chapter.id);
      } catch (e) {}
    }

    // Update Page & Document Title
    document.title = `Ch. ${chapter.chapterNumber}: ${chapter.title} — Biology: A Global Approach`;

    // Update Toolbar Badges & Chapter Info
    if (elements.currentUnitTag) {
      elements.currentUnitTag.textContent = chapter.unitGroup || 'Unit 1';
    }
    elements.currentChapterTitle.textContent = `Ch. ${chapter.chapterNumber}: ${chapter.title}`;

    // Update Chapter Header Card
    elements.cardUnitBadge.textContent = chapter.unitGroup || 'Unit';
    elements.cardPagesBadge.textContent = `${chapter.pages || 20} Pages`;
    elements.cardSizeBadge.textContent = chapter.fileSize || 'PDF';
    elements.cardTitle.textContent = `Chapter ${chapter.chapterNumber}: ${chapter.title}`;
    elements.cardSummary.textContent = chapter.summary || 'Explore the biological principles and mechanisms of this chapter.';
    
    // Update Concepts pills
    elements.cardConceptsList.innerHTML = '';
    if (chapter.concepts && chapter.concepts.length > 0) {
      chapter.concepts.forEach(concept => {
        const pill = document.createElement('span');
        pill.className = 'concept-pill';
        pill.textContent = concept;
        elements.cardConceptsList.appendChild(pill);
      });
    }

    // Update Download Buttons for active Unit PDF
    const unitNum = String(chapter.chapterNumber).padStart(2, '0');
    const pdfPath = chapter.pdf || `./units/unit_${unitNum}.pdf`;
    const fileName = `Biology_11th_Unit_${unitNum}.pdf`;

    if (elements.downloadChapterBtn) {
      elements.downloadChapterBtn.href = pdfPath;
      elements.downloadChapterBtn.setAttribute('download', fileName);
    }
    if (elements.sidebarDownloadUnitBtn) {
      elements.sidebarDownloadUnitBtn.href = pdfPath;
      elements.sidebarDownloadUnitBtn.setAttribute('download', fileName);
      if (elements.sidebarDownloadUnitText) {
        elements.sidebarDownloadUnitText.textContent = `Download Unit ${chapter.chapterNumber} PDF`;
      }
    }

    // Update Prev / Next Chapter Buttons
    updatePrevNextControls();

    // Highlight active item in sidebar tree
    updateActiveTreeHighlight();

    // Reset scroll position of reader viewport
    elements.readerViewport.scrollTo({ top: 0, behavior: 'smooth' });

    // Load and Render PDF
    await loadPdfDocument(chapter.pdf);
  }

  /**
   * Updates toolbar and bottom-card prev/next chapter navigation
   */
  function updatePrevNextControls() {
    const idx = state.currentChapterIndex;
    const prevChapter = idx > 0 ? state.chapters[idx - 1] : null;
    const nextChapter = idx < state.chapters.length - 1 ? state.chapters[idx + 1] : null;

    // Toolbar buttons
    elements.prevChapterBtn.disabled = !prevChapter;
    elements.nextChapterBtn.disabled = !nextChapter;

    // Bottom cards
    if (prevChapter) {
      elements.bottomPrevBtn.disabled = false;
      elements.bottomPrevTitle.textContent = `Chapter ${prevChapter.chapterNumber}: ${prevChapter.title}`;
      elements.bottomPrevSubtitle.textContent = prevChapter.unitGroup || '';
    } else {
      elements.bottomPrevBtn.disabled = true;
      elements.bottomPrevTitle.textContent = 'Beginning of Book';
      elements.bottomPrevSubtitle.textContent = 'Cover & Introductory Material';
    }

    if (nextChapter) {
      elements.bottomNextBtn.disabled = false;
      elements.bottomNextTitle.textContent = `Chapter ${nextChapter.chapterNumber}: ${nextChapter.title}`;
      elements.bottomNextSubtitle.textContent = nextChapter.unitGroup || '';
    } else {
      elements.bottomNextBtn.disabled = true;
      elements.bottomNextTitle.textContent = 'End of Available Units';
      elements.bottomNextSubtitle.textContent = 'Part 2 Coming Soon';
    }
  }

  /**
   * Updates the highlight state in the sidebar nav tree
   */
  function updateActiveTreeHighlight() {
    const items = elements.navTree.querySelectorAll('.nav-chapter-item');
    items.forEach(item => {
      const isCurrent = item.dataset.chapterId === state.currentChapter.id;
      item.classList.toggle('active', isCurrent);
      if (isCurrent) {
        // Ensure parent accordion is open
        const parentSection = item.closest('.nav-unit-section');
        if (parentSection && parentSection.classList.contains('collapsed')) {
          parentSection.classList.remove('collapsed');
          const header = parentSection.querySelector('.nav-unit-header');
          if (header) header.setAttribute('aria-expanded', 'true');
        }
      }
    });
  }

  /**
   * PDF Document Loader
   */
  async function loadPdfDocument(pdfUrl) {
    if (!pdfUrl) return;

    showStatus(`Loading Chapter PDF...`);

    // Show canvas viewer container
    elements.canvasViewerContainer.hidden = false;
    if (elements.nativeViewerContainer) {
      elements.nativeViewerContainer.hidden = true;
    }

    try {
      // Disconnect prior observer
      if (state.observer) {
        state.observer.disconnect();
      }
      state.renderedPages.clear();

      const loadingTask = window.pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true
      });

      state.pdfDoc = await loadingTask.promise;
      state.totalPages = state.pdfDoc.numPages;
      state.currentPageNum = 1;

      // Update Toolbar counters
      elements.pageNumberInput.value = 1;
      elements.pageNumberInput.max = state.totalPages;
      elements.totalPagesCount.textContent = state.totalPages;
      updateFloatingIndicator();

      // Build page skeleton placeholders
      setupPageContainers();

      hideStatus();
    } catch (err) {
      console.error('Failed to load PDF with PDF.js:', err);
      showStatus('Unable to load chapter PDF.');
    }
  }

  /**
   * Sets up containers for each page in the chapter and attaches lazy IntersectionObserver
   */
  function setupPageContainers() {
    const pagesList = elements.pagesList;
    pagesList.innerHTML = '';

    // Create placeholder wrappers for all pages
    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page-wrapper page-placeholder';
      pageWrapper.id = `pageWrapper-${pageNum}`;
      pageWrapper.dataset.pageNum = pageNum;

      // Tag indicating page number on hover
      const pageTag = document.createElement('div');
      pageTag.className = 'page-number-tag';
      pageTag.textContent = `Page ${pageNum}`;
      pageWrapper.appendChild(pageTag);

      pagesList.appendChild(pageWrapper);
    }

    // IntersectionObserver for High-Performance Lazy Page Rendering
    state.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.pageNum, 10);

        if (entry.isIntersecting) {
          // Render page if not already rendered
          if (!state.renderedPages.has(pageNum)) {
            renderSinglePage(pageNum);
          }
          // Only update active page number from scroll when not programmatically jumping
          if (!state.isProgrammaticScroll && entry.intersectionRatio >= 0.5) {
            updateCurrentPageNumber(pageNum);
          }
        }
      });
    }, {
      root: elements.readerViewport,
      rootMargin: '300px 0px 300px 0px', // Preload 300px before scroll
      threshold: [0.1, 0.5, 0.8]
    });

    // Observe all page wrappers
    const wrappers = pagesList.querySelectorAll('.page-wrapper');
    wrappers.forEach(w => state.observer.observe(w));

    // Immediately render first page
    renderSinglePage(1);
  }

  /**
   * Renders a single PDF page into its canvas container with HiDPI Retina support
   */
  async function renderSinglePage(pageNum) {
    if (!state.pdfDoc || state.renderedPages.has(pageNum)) return;
    state.renderedPages.add(pageNum);

    const wrapper = document.getElementById(`pageWrapper-${pageNum}`);
    if (!wrapper) return;

    try {
      const page = await state.pdfDoc.getPage(pageNum);

      // Base viewport at zoom level
      const baseViewport = page.getViewport({ scale: state.zoomLevel });
      const pixelRatio = window.devicePixelRatio || 1;

      // On mobile viewports, fit page smoothly to reader container width
      const viewportPadding = window.innerWidth <= 600 ? 16 : (window.innerWidth <= 860 ? 32 : 64);
      const containerWidth = elements.readerViewport.clientWidth - viewportPadding;
      const displayWidth = (window.innerWidth <= 860 && containerWidth > 0 && containerWidth < baseViewport.width)
        ? containerWidth
        : baseViewport.width;
      const displayHeight = (displayWidth / baseViewport.width) * baseViewport.height;

      // Create or reuse canvas
      let canvas = wrapper.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        wrapper.appendChild(canvas);
      }

      // High-resolution canvas dimensions
      canvas.width = Math.floor(baseViewport.width * pixelRatio);
      canvas.height = Math.floor(baseViewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(displayWidth)}px`;
      canvas.style.height = `${Math.floor(displayHeight)}px`;

      wrapper.style.width = `${Math.floor(displayWidth)}px`;
      wrapper.style.height = `${Math.floor(displayHeight)}px`;
      wrapper.classList.remove('page-placeholder');

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Transform matrix for HiDPI
      const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null;

      const renderContext = {
        canvasContext: ctx,
        viewport: baseViewport,
        transform: transform
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      state.renderedPages.delete(pageNum);
    }
  }

  /**
   * Re-renders all visible pages when zoom level changes
   */
  function reRenderPagesOnZoom() {
    state.renderedPages.clear();
    const wrappers = elements.pagesList.querySelectorAll('.page-wrapper');
    wrappers.forEach(wrapper => {
      const pageNum = parseInt(wrapper.dataset.pageNum, 10);
      renderSinglePage(pageNum);
    });
    updateFloatingIndicator();
  }

  /**
   * Updates Current Page Number in Toolbar and Floating Capsule
   */
  function updateCurrentPageNumber(pageNum) {
    if (state.currentPageNum === pageNum) return;
    state.currentPageNum = pageNum;
    elements.pageNumberInput.value = pageNum;
    updateFloatingIndicator();
  }

  /**
   * Scrolls reader viewport smoothly to a specific page
   */
  function scrollToPage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;
    const target = document.getElementById(`pageWrapper-${pageNum}`);
    if (target) {
      state.isProgrammaticScroll = true;
      clearTimeout(state.programmaticScrollTimer);

      updateCurrentPageNumber(pageNum);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      state.programmaticScrollTimer = setTimeout(() => {
        state.isProgrammaticScroll = false;
      }, 700);
    }
  }

  /**
   * Floating indicator update
   */
  function updateFloatingIndicator() {
    elements.floatingPageText.textContent = `Page ${state.currentPageNum} of ${state.totalPages}`;
    elements.floatingZoomText.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    elements.zoomPercentText.textContent = `${Math.round(state.zoomLevel * 100)}%`;
  }

  /**
   * Sets Zoom Level
   */
  function setZoom(newZoom) {
    // Clamp zoom between 50% and 250%
    const clamped = Math.min(Math.max(newZoom, 0.5), 2.5);
    state.zoomLevel = Math.round(clamped * 100) / 100;
    reRenderPagesOnZoom();
  }

  /**
   * Fit Width: calculates zoom to fit page comfortably in viewport
   */
  function fitToWidth() {
    if (!state.pdfDoc) return;
    state.pdfDoc.getPage(1).then(page => {
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const viewportWidth = elements.readerViewport.clientWidth - 80; // Margin padding
      const optimalZoom = viewportWidth / unscaledViewport.width;
      setZoom(optimalZoom);
      showToast(`Fit to Width: ${Math.round(state.zoomLevel * 100)}%`);
    });
  }

  /**
   * Status and Toast Notification Helpers
   */
  function showStatus(text) {
    elements.readerStatusText.textContent = text;
    elements.readerStatusOverlay.hidden = false;
  }

  function hideStatus() {
    elements.readerStatusOverlay.hidden = true;
  }

  let toastTimer = null;
  function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toastNotification.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toastNotification.hidden = true;
    }, 2800);
  }

  /**
   * Theme Management (Light / Dark)
   */
  function initTheme() {
    const saved = localStorage.getItem('biology_reader_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // Respect system color scheme
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    try {
      localStorage.setItem('biology_reader_theme', target);
    } catch (e) {}
    showToast(`Theme switched to ${target} mode`);
  }

  /**
   * Fullscreen Toggle
   */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  /**
   * Mobile Sidebar Drawer Helpers
   */
  function toggleMobileSidebar() {
    const isOpen = elements.sidebar.classList.toggle('open');
    elements.sidebarBackdrop.classList.toggle('active', isOpen);
  }

  function closeMobileSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarBackdrop.classList.remove('active');
  }

  /**
   * Deep Linking / Initial Index Detection
   */
  function getInitialChapterIndex() {
    const hash = window.location.hash.toLowerCase();
    if (hash.startsWith('#ch')) {
      const num = parseInt(hash.replace('#ch', ''), 10);
      const idx = state.chapters.findIndex(c => c.chapterNumber === num);
      if (idx !== -1) return idx;
    } else if (hash.startsWith('#unit-')) {
      const idx = state.chapters.findIndex(c => c.id === hash.replace('#', ''));
      if (idx !== -1) return idx;
    }

    // Try localStorage
    try {
      const savedId = localStorage.getItem('biology_last_chapter');
      if (savedId) {
        const idx = state.chapters.findIndex(c => c.id === savedId);
        if (idx !== -1) return idx;
      }
    } catch (e) {}

    return 0; // Default to Chapter 1
  }

  /**
   * Event Listeners Binding
   */
  function setupEventListeners() {
    // Sidebar Toggles
    elements.toggleSidebarBtn.addEventListener('click', () => {
      if (window.innerWidth <= 860) {
        toggleMobileSidebar();
      } else {
        elements.sidebar.classList.toggle('collapsed');
      }
    });

    elements.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    elements.sidebarBackdrop.addEventListener('click', closeMobileSidebar);

    // Search Input
    elements.chapterSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      elements.clearSearchBtn.hidden = !state.searchQuery;
      renderNavigationTree();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.chapterSearch.value = '';
      state.searchQuery = '';
      elements.clearSearchBtn.hidden = true;
      renderNavigationTree();
      elements.chapterSearch.focus();
    });

    // Filter Pills
    elements.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        elements.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeFilter = pill.dataset.filter;
        renderNavigationTree();
      });
    });

    // Prev / Next Chapter Buttons
    elements.prevChapterBtn.addEventListener('click', () => {
      if (state.currentChapterIndex > 0) {
        selectChapter(state.currentChapterIndex - 1, true);
      }
    });

    elements.nextChapterBtn.addEventListener('click', () => {
      if (state.currentChapterIndex < state.chapters.length - 1) {
        selectChapter(state.currentChapterIndex + 1, true);
      }
    });

    elements.bottomPrevBtn.addEventListener('click', () => {
      if (state.currentChapterIndex > 0) {
        selectChapter(state.currentChapterIndex - 1, true);
      }
    });

    elements.bottomNextBtn.addEventListener('click', () => {
      if (state.currentChapterIndex < state.chapters.length - 1) {
        selectChapter(state.currentChapterIndex + 1, true);
      }
    });

    // Page Controls
    elements.prevPageBtn.addEventListener('click', () => {
      scrollToPage(state.currentPageNum - 1);
    });

    elements.nextPageBtn.addEventListener('click', () => {
      scrollToPage(state.currentPageNum + 1);
    });

    elements.pageNumberInput.addEventListener('change', (e) => {
      const pageVal = parseInt(e.target.value, 10);
      if (!isNaN(pageVal)) {
        scrollToPage(pageVal);
      }
    });

    // Zoom Controls
    elements.zoomInBtn.addEventListener('click', () => setZoom(state.zoomLevel + 0.2));
    elements.zoomOutBtn.addEventListener('click', () => setZoom(state.zoomLevel - 0.2));
    elements.zoomResetBtn.addEventListener('click', () => setZoom(1.0));
    elements.fitWidthBtn.addEventListener('click', fitToWidth);

    // Theme Toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Quiz Trigger Buttons
    const toolbarQuizBtn = document.getElementById('toolbarQuizBtn');
    const cardQuizBtn = document.getElementById('cardQuizBtn');
    if (toolbarQuizBtn) {
      toolbarQuizBtn.addEventListener('click', () => {
        if (window.QuizEngine && state.currentChapter) {
          QuizEngine.open(state.currentChapter.id);
        }
      });
    }
    if (cardQuizBtn) {
      cardQuizBtn.addEventListener('click', () => {
        if (window.QuizEngine && state.currentChapter) {
          QuizEngine.open(state.currentChapter.id);
        }
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't intercept if inside input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      switch (e.key) {
        case '[':
          e.preventDefault();
          if (state.currentChapterIndex > 0) selectChapter(state.currentChapterIndex - 1, true);
          break;
        case ']':
          e.preventDefault();
          if (state.currentChapterIndex < state.chapters.length - 1) selectChapter(state.currentChapterIndex + 1, true);
          break;
        case 'j':
        case 'ArrowDown':
          if (e.altKey || e.metaKey) return;
          e.preventDefault();
          scrollToPage(state.currentPageNum + 1);
          break;
        case 'k':
        case 'ArrowUp':
          if (e.altKey || e.metaKey) return;
          e.preventDefault();
          scrollToPage(state.currentPageNum - 1);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(state.zoomLevel + 0.2);
          break;
        case '-':
          e.preventDefault();
          setZoom(state.zoomLevel - 0.2);
          break;
        case '0':
          e.preventDefault();
          setZoom(1.0);
          break;
        case '/':
          e.preventDefault();
          elements.chapterSearch.focus();
          break;
        case 'd':
        case 'D':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleTheme();
          }
          break;
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'Escape':
          if (window.QuizEngine) QuizEngine.close();
          closeMobileSidebar();
          break;
        case 'q':
        case 'Q':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (window.QuizEngine && state.currentChapter) {
              QuizEngine.open(state.currentChapter.id);
            }
          }
          break;
      }
    });

    // Fade floating page indicator when idle
    let scrollTimer = null;
    elements.readerViewport.addEventListener('scroll', () => {
      elements.floatingPageIndicator.classList.remove('faded');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        elements.floatingPageIndicator.classList.add('faded');
      }, 2500);
    }, { passive: true });

    // Window resize handler (handles mobile orientation change)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.pdfDoc && window.innerWidth <= 860) {
          reRenderPagesOnZoom();
        }
      }, 250);
    }, { passive: true });
  }

  /**
   * Utilities
   */
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }

  // Expose current chapter for quiz engine
  window.getAppState = function() {
    return { currentChapter: state.currentChapter };
  };

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
