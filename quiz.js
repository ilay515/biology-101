/**
 * Biology: A Global Approach — Quiz Engine Module
 * Vanilla JavaScript IIFE module exposing window.QuizEngine
 */

(function () {
  'use strict';

  // SVG Icons
  const CHECK_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const CROSS_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // Module state
  let modalContainer = null;
  let domElements = null;
  let domInitialized = false;

  let activeChapterId = null;
  let currentChapterTitle = '';
  let originalQuestions = [];
  let questions = [];
  let currentQuestionIndex = 0;
  let score = 0;
  let selectedIndices = new Set();
  let isAnswerChecked = false;
  let isOpen = false;

  /**
   * Fisher-Yates array shuffle algorithm
   * @param {Array} array
   * @returns {Array} Shuffled copy of array
   */
  function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  /**
   * Retrieve chapter data and questions from global QUIZ_DATA
   * Supports various QUIZ_DATA schemas (keyed by unit-id, number, array, etc.)
   * @param {string|number} chapterId
   * @returns {{questions: Array, title: string}}
   */
  function loadChapterData(chapterId) {
    if (typeof window === 'undefined' || !window.QUIZ_DATA) {
      if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA) {
        window.QUIZ_DATA = QUIZ_DATA;
      } else {
        console.warn('QuizEngine: QUIZ_DATA is not defined');
        return { questions: [], title: '' };
      }
    }

    const dataSource = window.QUIZ_DATA;
    let data = null;

    // 1. Direct match on key
    if (chapterId !== undefined && chapterId !== null) {
      if (dataSource[chapterId]) {
        data = dataSource[chapterId];
      } else if (dataSource[String(chapterId)]) {
        data = dataSource[String(chapterId)];
      } else {
        // 2. Try normalized ID formats (e.g. "unit-01", "1", 1)
        const strId = String(chapterId);
        const match = strId.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          const padded = String(num).padStart(2, '0');
          const candidates = [
            num,
            String(num),
            `unit-${padded}`,
            `unit-${num}`,
            `chapter-${num}`,
            `chapter-${padded}`,
            `ch-${num}`,
            `ch-${padded}`
          ];
          for (const cand of candidates) {
            if (dataSource[cand]) {
              data = dataSource[cand];
              break;
            }
          }
        }
      }
    }

    // 3. If dataSource is an Array, search by ID or chapter number
    if (!data && Array.isArray(dataSource)) {
      if (chapterId !== undefined && chapterId !== null) {
        data = dataSource.find(item =>
          item && (
            item.id === chapterId ||
            item.chapterId === chapterId ||
            item.chapterNumber === chapterId ||
            String(item.chapterNumber) === String(chapterId) ||
            item.id === `unit-${String(chapterId).padStart(2, '0')}`
          )
        );
      }
      if (!data && dataSource.length > 0) {
        data = dataSource[0];
      }
    }

    // 4. If dataSource has a 'chapters' map or array
    if (!data && dataSource && typeof dataSource.chapters === 'object') {
      if (dataSource.chapters[chapterId]) {
        data = dataSource.chapters[chapterId];
      } else if (Array.isArray(dataSource.chapters)) {
        data = dataSource.chapters.find(item =>
          item && (
            item.id === chapterId ||
            item.chapterId === chapterId ||
            item.chapterNumber === chapterId
          )
        );
      }
    }

    // 5. If no chapterId provided or not found, fallback to first available chapter in QUIZ_DATA
    if (!data && typeof dataSource === 'object') {
      const keys = Object.keys(dataSource);
      if (keys.length > 0) {
        data = dataSource[keys[0]];
      }
    }

    if (!data) {
      return { questions: [], title: '' };
    }

    let questionsList = [];
    let title = '';

    if (Array.isArray(data)) {
      questionsList = data;
      title = data.chapterTitleHe || data.titleHe || data.hebrewTitle || data.title || data.chapterTitle || '';
    } else if (typeof data === 'object' && data !== null) {
      questionsList = data.questions || data.items || data.quiz || [];
      title = data.chapterTitleHe || data.titleHe || data.hebrewTitle || data.title || data.chapterTitle || data.name || '';
    }

    if (!title && chapterId !== undefined && chapterId !== null) {
      const numMatch = String(chapterId).match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0], 10) : '';
      title = num ? `פרק ${num}` : `פרק ${chapterId}`;
    }

    return {
      questions: Array.isArray(questionsList) ? questionsList : [],
      title: title || 'חידון פרק'
    };
  }

  /**
   * Resolves the set of correct option indices (0-based) for a question
   * Supports: correctAnswers array, correctAnswer value, letter IDs, option.isCorrect
   * @param {Object} q Question object
   * @returns {Set<number>} Set of 0-based indices
   */
  function getCorrectIndices(q) {
    const correct = new Set();
    const options = q.options || q.choices || q.answers || [];

    function addAnswerRef(ref) {
      if (typeof ref === 'number') {
        if (ref >= 0 && ref < options.length) {
          correct.add(ref);
        }
        return;
      }
      if (typeof ref === 'string') {
        const trimmed = ref.trim();
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && String(num) === trimmed) {
          if (num >= 0 && num < options.length) {
            correct.add(num);
            return;
          }
        }
        // Match option ID or option text or letter index ('A', 'B', etc.)
        let matched = false;
        options.forEach((opt, idx) => {
          const optId = typeof opt === 'object' && opt !== null ? opt.id : null;
          const optText = typeof opt === 'string' ? opt : (opt.text || opt.label || '');
          if ((optId !== null && String(optId).toLowerCase() === trimmed.toLowerCase()) || optText === trimmed) {
            correct.add(idx);
            matched = true;
          }
        });

        if (!matched && /^[a-dA-D]$/.test(trimmed)) {
          const letterIdx = trimmed.toUpperCase().charCodeAt(0) - 65;
          if (letterIdx >= 0 && letterIdx < options.length) {
            correct.add(letterIdx);
          }
        }
      }
    }

    if (Array.isArray(q.correctAnswers)) {
      q.correctAnswers.forEach(addAnswerRef);
    } else if (q.correctAnswers instanceof Set) {
      q.correctAnswers.forEach(addAnswerRef);
    } else if (typeof q.correctAnswer !== 'undefined') {
      addAnswerRef(q.correctAnswer);
    }

    // Also check individual option objects for isCorrect / correct flag
    options.forEach((opt, idx) => {
      if (typeof opt === 'object' && opt !== null) {
        if (opt.isCorrect === true || opt.correct === true) {
          correct.add(idx);
        }
      }
    });

    return correct;
  }

  /**
   * Dynamically builds the DOM structure inside #quizModal
   */
  function initDOM() {
    if (domInitialized && domElements) return domElements;

    modalContainer = document.getElementById('quizModal');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'quizModal';
      modalContainer.className = 'quiz-modal-backdrop';
      modalContainer.hidden = true;
      if (document.body) {
        document.body.appendChild(modalContainer);
      }
    }

    // Clear any existing children to prevent duplication
    modalContainer.innerHTML = '';
    modalContainer.setAttribute('role', 'dialog');
    modalContainer.setAttribute('aria-modal', 'true');

    // .quiz-modal-card
    const card = document.createElement('div');
    card.className = 'quiz-modal-card';

    // .quiz-modal-header
    const header = document.createElement('div');
    header.className = 'quiz-modal-header';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'quiz-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'סגור חידון');
    closeBtn.innerHTML = '&times;';

    const progressText = document.createElement('div');
    progressText.className = 'quiz-progress-text';
    progressText.textContent = '';

    header.appendChild(closeBtn);
    header.appendChild(progressText);

    // .quiz-progress-bar-container
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'quiz-progress-bar-container';

    const progressBarFill = document.createElement('div');
    progressBarFill.className = 'quiz-progress-bar-fill';
    progressBarFill.style.width = '0%';
    progressBarContainer.appendChild(progressBarFill);

    // .quiz-modal-body [dir="rtl" lang="he"]
    const modalBody = document.createElement('div');
    modalBody.className = 'quiz-modal-body';
    modalBody.setAttribute('dir', 'rtl');
    modalBody.setAttribute('lang', 'he');

    const chapterContext = document.createElement('div');
    chapterContext.className = 'quiz-chapter-context';

    const questionCard = document.createElement('div');
    questionCard.className = 'quiz-question-card';

    const questionText = document.createElement('div');
    questionText.className = 'quiz-question-text';

    const optionsList = document.createElement('div');
    optionsList.className = 'quiz-options-list';

    questionCard.appendChild(questionText);
    questionCard.appendChild(optionsList);

    const explanationBox = document.createElement('div');
    explanationBox.className = 'quiz-explanation-box';
    explanationBox.hidden = true;

    const actionBtn = document.createElement('button');
    actionBtn.className = 'quiz-action-btn';
    actionBtn.type = 'button';
    actionBtn.textContent = 'בדוק תשובה';
    actionBtn.disabled = true;

    modalBody.appendChild(chapterContext);
    modalBody.appendChild(questionCard);
    modalBody.appendChild(explanationBox);
    modalBody.appendChild(actionBtn);

    // .quiz-results-view
    const resultsView = document.createElement('div');
    resultsView.className = 'quiz-results-view';
    resultsView.setAttribute('dir', 'rtl');
    resultsView.setAttribute('lang', 'he');
    resultsView.hidden = true;

    const resultsEmoji = document.createElement('div');
    resultsEmoji.className = 'quiz-results-emoji';

    const resultsTitle = document.createElement('div');
    resultsTitle.className = 'quiz-results-title';
    resultsTitle.textContent = 'הציון שלך';

    const resultsScore = document.createElement('div');
    resultsScore.className = 'quiz-results-score';

    const resultsBarContainer = document.createElement('div');
    resultsBarContainer.className = 'quiz-results-bar-container';

    const resultsBarFill = document.createElement('div');
    resultsBarFill.className = 'quiz-results-bar-fill';
    resultsBarFill.style.width = '0%';
    resultsBarContainer.appendChild(resultsBarFill);

    const resultsFeedback = document.createElement('div');
    resultsFeedback.className = 'quiz-results-feedback';

    const resultsActions = document.createElement('div');
    resultsActions.className = 'quiz-results-actions';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'quiz-retry-btn';
    retryBtn.type = 'button';
    retryBtn.textContent = 'נסה שוב';

    const closeResultsBtn = document.createElement('button');
    closeResultsBtn.className = 'quiz-close-results-btn';
    closeResultsBtn.type = 'button';
    closeResultsBtn.textContent = 'חזור לפרק';

    resultsActions.appendChild(retryBtn);
    resultsActions.appendChild(closeResultsBtn);

    resultsView.appendChild(resultsEmoji);
    resultsView.appendChild(resultsTitle);
    resultsView.appendChild(resultsScore);
    resultsView.appendChild(resultsBarContainer);
    resultsView.appendChild(resultsFeedback);
    resultsView.appendChild(resultsActions);

    // Assemble Card & Modal
    card.appendChild(header);
    card.appendChild(progressBarContainer);
    card.appendChild(modalBody);
    card.appendChild(resultsView);
    modalContainer.appendChild(card);

    // Event Listeners
    closeBtn.addEventListener('click', close);
    closeResultsBtn.addEventListener('click', close);
    retryBtn.addEventListener('click', retry);
    actionBtn.addEventListener('click', handleActionClick);

    // Click backdrop to close
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        close();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    });

    domElements = {
      modalContainer,
      card,
      header,
      closeBtn,
      progressText,
      progressBarContainer,
      progressBarFill,
      modalBody,
      chapterContext,
      questionCard,
      questionText,
      optionsList,
      explanationBox,
      actionBtn,
      resultsView,
      resultsEmoji,
      resultsTitle,
      resultsScore,
      resultsBarContainer,
      resultsBarFill,
      resultsFeedback,
      resultsActions,
      retryBtn,
      closeResultsBtn
    };

    domInitialized = true;
    return domElements;
  }

  /**
   * Toggles selection of an option index
   * @param {number} optIndex
   * @param {HTMLElement} optionEl
   */
  function toggleOption(optIndex, optionEl) {
    if (isAnswerChecked) return;

    const indicator = optionEl.querySelector('.quiz-option-indicator');

    if (selectedIndices.has(optIndex)) {
      selectedIndices.delete(optIndex);
      optionEl.classList.remove('selected');
      optionEl.setAttribute('aria-checked', 'false');
      if (indicator) indicator.innerHTML = '';
    } else {
      selectedIndices.add(optIndex);
      optionEl.classList.add('selected');
      optionEl.setAttribute('aria-checked', 'true');
      if (indicator) indicator.innerHTML = CHECK_ICON_SVG;
    }

    // "בדוק תשובה" button only enabled when at least 1 option selected
    if (domElements && domElements.actionBtn) {
      domElements.actionBtn.disabled = selectedIndices.size === 0;
    }
  }

  /**
   * Renders the question at the specified index
   * @param {number} index
   */
  function renderQuestion(index) {
    if (!domElements) initDOM();
    if (index < 0 || index >= questions.length) return;

    currentQuestionIndex = index;
    isAnswerChecked = false;
    selectedIndices.clear();

    const q = questions[index];
    const total = questions.length;

    // View toggling
    domElements.modalBody.hidden = false;
    domElements.resultsView.hidden = true;

    // Header progress
    domElements.progressText.textContent = `שאלה ${index + 1} מתוך ${total}`;
    const progressPercent = ((index + 1) / total) * 100;
    domElements.progressBarFill.style.width = `${progressPercent}%`;

    // Context & Question
    domElements.chapterContext.textContent = currentChapterTitle;
    domElements.questionText.textContent = q.question || q.text || q.prompt || '';

    // Options list
    domElements.optionsList.innerHTML = '';
    const rawOptions = q.options || q.choices || q.answers || [];

    rawOptions.forEach((opt, optIndex) => {
      const optEl = document.createElement('div');
      optEl.className = 'quiz-option';
      optEl.setAttribute('role', 'checkbox');
      optEl.setAttribute('aria-checked', 'false');
      optEl.setAttribute('tabindex', '0');

      const indicator = document.createElement('span');
      indicator.className = 'quiz-option-indicator quiz-checkbox-indicator';

      const textSpan = document.createElement('span');
      textSpan.className = 'quiz-option-text';
      textSpan.textContent = typeof opt === 'string' ? opt : (opt.text || opt.label || '');

      optEl.appendChild(indicator);
      optEl.appendChild(textSpan);

      optEl.addEventListener('click', () => {
        toggleOption(optIndex, optEl);
      });

      optEl.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleOption(optIndex, optEl);
        }
      });

      domElements.optionsList.appendChild(optEl);
    });

    // Reset Explanation & Action Button
    domElements.explanationBox.hidden = true;
    domElements.explanationBox.innerHTML = '';

    domElements.actionBtn.textContent = 'בדוק תשובה';
    domElements.actionBtn.disabled = true;
  }

  /**
   * Validates selected options against correct answers
   */
  function checkAnswer() {
    if (isAnswerChecked) return;
    if (selectedIndices.size === 0) return;

    isAnswerChecked = true;
    const q = questions[currentQuestionIndex];
    const correctIndices = getCorrectIndices(q);

    // Check correctness: exactly matches correctAnswers set
    const isQuestionCorrect = (
      selectedIndices.size === correctIndices.size &&
      [...selectedIndices].every(idx => correctIndices.has(idx))
    );

    if (isQuestionCorrect) {
      score++;
    }

    // Update option elements:
    // - all options get .disabled
    // - correct ones get .correct
    // - incorrectly-selected options get .incorrect
    const optionEls = domElements.optionsList.querySelectorAll('.quiz-option');
    optionEls.forEach((el, idx) => {
      el.classList.add('disabled');
      el.setAttribute('aria-disabled', 'true');

      const indicator = el.querySelector('.quiz-option-indicator');
      const isCorrectOption = correctIndices.has(idx);
      const isSelected = selectedIndices.has(idx);

      if (isCorrectOption) {
        el.classList.add('correct');
        if (indicator) indicator.innerHTML = CHECK_ICON_SVG;
      }
      if (isSelected && !isCorrectOption) {
        el.classList.add('incorrect');
        if (indicator) indicator.innerHTML = CROSS_ICON_SVG;
      }
      if (!isSelected && !isCorrectOption) {
        if (indicator) indicator.innerHTML = '';
      }
    });

    // Show explanation box
    domElements.explanationBox.innerHTML = '';
    const explanationText = q.explanation || q.rationale || '';
    if (explanationText) {
      const expTitle = document.createElement('div');
      expTitle.className = 'quiz-explanation-title';
      expTitle.textContent = 'הסבר:';

      const expBody = document.createElement('div');
      expBody.className = 'quiz-explanation-text';
      expBody.textContent = explanationText;

      domElements.explanationBox.appendChild(expTitle);
      domElements.explanationBox.appendChild(expBody);
    } else {
      const expBody = document.createElement('div');
      expBody.className = 'quiz-explanation-text';
      expBody.textContent = isQuestionCorrect ? 'תשובה נכונה!' : 'תשובה שגויה.';
      domElements.explanationBox.appendChild(expBody);
    }
    domElements.explanationBox.hidden = false;

    // Advance button configuration
    domElements.actionBtn.disabled = false;
    if (currentQuestionIndex === questions.length - 1) {
      domElements.actionBtn.textContent = 'הצג תוצאות';
    } else {
      domElements.actionBtn.textContent = 'שאלה הבאה';
    }
  }

  /**
   * Handles action button click ("בדוק תשובה" / "שאלה הבאה" / "הצג תוצאות")
   */
  function handleActionClick() {
    if (!isAnswerChecked) {
      checkAnswer();
    } else {
      if (currentQuestionIndex < questions.length - 1) {
        renderQuestion(currentQuestionIndex + 1);
      } else {
        showResults();
      }
    }
  }

  /**
   * Displays the quiz results screen
   */
  function showResults() {
    if (!domElements) initDOM();

    domElements.modalBody.hidden = true;
    domElements.resultsView.hidden = false;

    const total = questions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    let emoji = '';
    let feedback = '';

    if (percentage >= 90) {
      emoji = '🌟';
      feedback = 'מצוין! שליטה מלאה בחומר 🌟';
    } else if (percentage >= 70) {
      emoji = '👏';
      feedback = 'כל הכבוד! רוב החומר ברור 👏';
    } else if (percentage >= 50) {
      emoji = '📖';
      feedback = 'לא רע, אבל כדאי לחזור על חלק מהנושאים 📖';
    } else {
      emoji = '💪';
      feedback = 'מומלץ לחזור על הפרק ולנסות שוב 💪';
    }

    domElements.resultsEmoji.textContent = emoji;
    domElements.resultsTitle.textContent = 'הציון שלך';
    domElements.resultsScore.textContent = `${score}/${total}`;
    domElements.resultsBarFill.style.width = `${percentage}%`;

    // Apply color tier classes for stylesheet
    domElements.resultsBarFill.classList.remove('score-high', 'score-green', 'score-medium', 'score-blue', 'score-low', 'score-red');
    if (percentage >= 70) {
      domElements.resultsBarFill.classList.add('score-high', 'score-green');
      domElements.resultsBarFill.setAttribute('data-score', 'high');
    } else if (percentage >= 50) {
      domElements.resultsBarFill.classList.add('score-medium', 'score-blue');
      domElements.resultsBarFill.setAttribute('data-score', 'medium');
    } else {
      domElements.resultsBarFill.classList.add('score-low', 'score-red');
      domElements.resultsBarFill.setAttribute('data-score', 'low');
    }

    domElements.resultsFeedback.textContent = feedback;

    domElements.progressText.textContent = 'תוצאות החידון';
    domElements.progressBarFill.style.width = '100%';
  }

  /**
   * Reshuffles and restarts the quiz for the current chapter
   */
  function retry() {
    if (!originalQuestions || originalQuestions.length === 0) return;
    questions = shuffleArray(originalQuestions);
    currentQuestionIndex = 0;
    score = 0;
    selectedIndices.clear();
    isAnswerChecked = false;
    renderQuestion(0);
  }

  /**
   * Opens the quiz modal for a given chapter
   * @param {string|number} chapterId
   */
  function open(chapterId) {
    initDOM();

    activeChapterId = chapterId;
    const { questions: loadedQuestions, title } = loadChapterData(chapterId);

    if (!loadedQuestions || loadedQuestions.length === 0) {
      console.warn('QuizEngine: No questions available for chapter:', chapterId);
      currentChapterTitle = title || (chapterId ? `פרק ${chapterId}` : 'חידון');
      originalQuestions = [];
      questions = [];
      currentQuestionIndex = 0;
      score = 0;
      selectedIndices.clear();
      isAnswerChecked = false;

      domElements.modalBody.hidden = false;
      domElements.resultsView.hidden = true;
      domElements.chapterContext.textContent = currentChapterTitle;
      domElements.questionText.textContent = 'לא נמצאו שאלות זמינות לפרק זה.';
      domElements.optionsList.innerHTML = '';
      domElements.explanationBox.hidden = true;
      domElements.actionBtn.disabled = true;
      domElements.actionBtn.textContent = 'בדוק תשובה';
      domElements.progressText.textContent = '';
      domElements.progressBarFill.style.width = '0%';

      modalContainer.hidden = false;
      modalContainer.removeAttribute('hidden');
      isOpen = true;
      document.body.style.overflow = 'hidden';
      return;
    }

    currentChapterTitle = title;
    originalQuestions = [...loadedQuestions];
    questions = shuffleArray(originalQuestions);
    currentQuestionIndex = 0;
    score = 0;
    selectedIndices.clear();
    isAnswerChecked = false;

    modalContainer.hidden = false;
    modalContainer.removeAttribute('hidden');
    isOpen = true;
    document.body.style.overflow = 'hidden';

    renderQuestion(0);
  }

  /**
   * Closes the modal and resets state
   */
  function close() {
    if (modalContainer) {
      modalContainer.hidden = true;
      modalContainer.setAttribute('hidden', '');
    }

    isOpen = false;
    activeChapterId = null;
    currentChapterTitle = '';
    originalQuestions = [];
    questions = [];
    currentQuestionIndex = 0;
    score = 0;
    selectedIndices.clear();
    isAnswerChecked = false;

    if (domElements) {
      domElements.modalBody.hidden = false;
      domElements.resultsView.hidden = true;
      domElements.optionsList.innerHTML = '';
      domElements.questionText.textContent = '';
      domElements.explanationBox.hidden = true;
      domElements.explanationBox.innerHTML = '';
      domElements.progressBarFill.style.width = '0%';
      domElements.resultsBarFill.style.width = '0%';
      domElements.progressText.textContent = '';
      domElements.actionBtn.disabled = true;
      domElements.actionBtn.textContent = 'בדוק תשובה';
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
  }

  // Initialize DOM if document is already ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDOM);
    } else {
      initDOM();
    }
  }

  // Public API
  const QuizEngine = {
    open,
    close,
    retry,
    getState: function () {
      return {
        isOpen,
        activeChapterId,
        currentQuestionIndex,
        totalQuestions: questions.length,
        score,
        isAnswerChecked
      };
    }
  };

  // Expose as global QuizEngine
  if (typeof window !== 'undefined') {
    window.QuizEngine = QuizEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizEngine;
  }

  return QuizEngine;
})();
