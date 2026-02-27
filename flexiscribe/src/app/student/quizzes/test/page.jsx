"use client";
import React, { useState, useRef, useReducer } from "react";
import { useRouter } from "next/navigation";
import { FaChevronDown, FaSpinner } from "react-icons/fa";
import "./styles.css";
import "../../dashboard/styles.css";
import "../styles.css";

// ============================================================================
// ROBUST STATE MANAGEMENT - Prevents partial data loss on errors
// ============================================================================

const quizReducer = (state, action) => {
  switch (action.type) {
    case 'START_GENERATION':
      return {
        ...state,
        isGenerating: true,
        error: null,
        quiz: null,
      };
    
    case 'GENERATION_SUCCESS':
      return {
        ...state,
        isGenerating: false,
        quiz: action.payload,
        error: null,
      };
    
    case 'GENERATION_ERROR':
      return {
        ...state,
        isGenerating: false,
        error: action.payload,
        // CRITICAL: Do NOT clear quiz data on error - preserve any partial results
      };
    
    case 'CLEAR_QUIZ':
      return {
        ...state,
        quiz: null,
        error: null,
      };
    
    default:
      return state;
  }
};

const initialQuizState = {
  isGenerating: false,
  quiz: null,
  error: null,
};

export default function QuizTestPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [selectedQuizType, setSelectedQuizType] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedNumQuestions, setSelectedNumQuestions] = useState("");
  
  // Use reducer for robust state management
  const [quizState, dispatch] = useReducer(quizReducer, initialQuizState);

  // Dropdown states
  const [quizTypeDropdownOpen, setQuizTypeDropdownOpen] = useState(false);
  const [difficultyDropdownOpen, setDifficultyDropdownOpen] = useState(false);

  // Refs
  const quizTypeDropdownRef = useRef(null);
  const difficultyDropdownRef = useRef(null);

  const quizTypes = [
    { value: "MCQ", label: "Multiple Choice" },
    { value: "FILL_IN_BLANK", label: "Fill in the Blanks" },
    { value: "FLASHCARD", label: "Flashcards" }
  ];

  const difficulties = [
    { value: "EASY", label: "Easy" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HARD", label: "Hard" }
  ];

  const questionNumbers = [5, 10, 15, 20];

  // ============================================================================
  // SAFE ASYNC HANDLER - Preserves partial results, distinguishes error types
  // ============================================================================
  
  const handleGenerateQuiz = async () => {
    // Validation
    if (!content.trim() || !selectedQuizType || !selectedDifficulty || !selectedNumQuestions) {
      dispatch({ 
        type: 'GENERATION_ERROR', 
        payload: "Please fill in all fields including the content" 
      });
      return;
    }

    // Start generation
    dispatch({ type: 'START_GENERATION' });

    try {
      console.log('📤 Sending quiz generation request to API...');
      
      // Set reasonable timeout for long-running generation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout

      const response = await fetch('/api/quizzes/test-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          type: selectedQuizType,
          difficulty: selectedDifficulty,
          count: selectedNumQuestions,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        throw new Error('Server returned invalid JSON. Generation may have timed out.');
      }

      console.log('📥 Received response:', { 
        ok: response.ok, 
        success: data.success,
        hasQuiz: !!data.quiz,
        validCount: data.quiz?.questions?.length,
        rejectedCount: data.quiz?.rejectedItems?.length,
      });

      // Handle successful response
      if (response.ok && data.success) {
        // CRITICAL: Even if there's partial data, consider it a success
        if (data.quiz && data.quiz.questions && data.quiz.questions.length > 0) {
          console.log(`✅ Generation successful: ${data.quiz.questions.length} valid questions`);
          dispatch({ 
            type: 'GENERATION_SUCCESS', 
            payload: data.quiz 
          });
        } else {
          // No valid questions generated
          dispatch({ 
            type: 'GENERATION_ERROR', 
            payload: 'No valid questions were generated. Try easier difficulty or different content.' 
          });
        }
      } else {
        // Server error or validation failure
        const errorMsg = data.error || 'Failed to generate quiz';
        console.error('❌ Server error:', errorMsg, data.details);
        dispatch({ 
          type: 'GENERATION_ERROR', 
          payload: errorMsg 
        });
      }

    } catch (error) {
      console.error('❌ Quiz generation error:', error);
      
      // Distinguish error types for better UX
      let errorMessage;
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout after 10 minutes. Try generating fewer questions or easier difficulty.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error. Please ensure Ollama is running (ollama serve) and the dev server is accessible.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid server response. The generation may have partially succeeded - check server logs.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      dispatch({ 
        type: 'GENERATION_ERROR', 
        payload: errorMessage 
      });
    }
  };

  const handleViewAsQuiz = () => {
    const { quiz } = quizState;
    if (!quiz) return;
    
    // Save quiz to localStorage for test-view page
    localStorage.setItem('generated-test-quiz', JSON.stringify(quiz));
    
    // Navigate to test-view page
    router.push('/student/quizzes/test-view');
  };
  
  const renderQuizPreview = () => {
    const { quiz } = quizState;
    if (!quiz) return null;

    const validQuestions = quiz.questions || [];
    const rejectedQuestions = quiz.rejectedItems || [];

    return (
      <div className="quiz-preview-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="quiz-preview-title" style={{ margin: 0 }}>
            Generated {quiz.type} Quiz ({quiz.difficulty})
          </h3>
          <button 
            onClick={handleViewAsQuiz}
            style={{
              background: 'linear-gradient(135deg, #9D8ADB 0%, #C5A6F9 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(157, 138, 219, 0.3)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(157, 138, 219, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(157, 138, 219, 0.3)';
            }}
          >
            🎯 View as Interactive Quiz
          </button>
        </div>
        
        {quiz.stats && (
          <div className="quiz-stats">
            <span className="stat-item">✓ Valid: {quiz.stats.generated}</span>
            <span className="stat-item">✗ Rejected: {quiz.stats.rejected}</span>
            <span className="stat-item">Waves: {quiz.stats.waves ?? quiz.stats.attempts} ({quiz.stats.apiCalls ?? '?'} calls)</span>
          </div>
        )}

        <div className="quiz-preview-items">
          {/* Valid Questions */}
          {validQuestions.map((item, index) => (
            <div key={index} className="quiz-preview-item">
              <div className="quiz-item-number">Question {index + 1}</div>
              
              {quiz.type === 'mcq' && (
                <>
                  <div className="quiz-item-question">{item.question}</div>
                  <div className="quiz-item-choices">
                    {item.choices?.map((choice, i) => (
                      <div 
                        key={i} 
                        className={`quiz-item-choice ${i === item.answerIndex ? 'correct' : ''}`}
                      >
                        {String.fromCharCode(65 + i)}. {choice}
                        {i === item.answerIndex && <span className="correct-badge">✓ Correct</span>}
                      </div>
                    ))}
                  </div>
                  {item.explanation && (
                    <div className="quiz-item-explanation">
                      <strong>Explanation:</strong> {item.explanation}
                    </div>
                  )}
                </>
              )}

              {quiz.type === 'fill_blank' && (
                <>
                  <div className="quiz-item-question">{item.sentence}</div>
                  <div className="quiz-item-answer">
                    <strong>Answer:</strong> {item.answer}
                  </div>
                  {item.distractors && item.distractors.length > 0 && (
                    <div className="quiz-item-distractors">
                      <strong>Distractors:</strong> {item.distractors.join(', ')}
                    </div>
                  )}
                </>
              )}

              {quiz.type === 'flashcard' && (
                <>
                  <div className="flashcard-front">
                    <strong>Front:</strong> {item.front}
                  </div>
                  <div className="flashcard-back">
                    <strong>Back:</strong> {item.back}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Rejected Questions */}
          {rejectedQuestions.length > 0 && (
            <>
              <div className="rejected-section-divider">
                <h4>Rejected Items ({rejectedQuestions.length})</h4>
              </div>
              
              {rejectedQuestions.map((item, index) => (
                <div key={`rejected-${index}`} className="quiz-preview-item rejected-item">
                  <div className="quiz-item-number rejected-number">
                    Question {validQuestions.length + index + 1} 
                    <span className="rejected-badge">REJECTED</span>
                  </div>
                  
                  {item._rejectionReason && (
                    <div className="rejection-reason">
                      <strong>Reason:</strong> {item._rejectionReason}
                    </div>
                  )}
                  
                  {quiz.type === 'mcq' && (
                    <>
                      <div className="quiz-item-question">{item.question}</div>
                      <div className="quiz-item-choices">
                        {item.choices?.map((choice, i) => (
                          <div 
                            key={i} 
                            className={`quiz-item-choice ${i === item.answerIndex ? 'correct' : ''}`}
                          >
                            {String.fromCharCode(65 + i)}. {choice}
                            {i === item.answerIndex && <span className="correct-badge">✓ Marked Correct</span>}
                          </div>
                        ))}
                      </div>
                      {item.explanation && (
                        <div className="quiz-item-explanation">
                          <strong>Explanation:</strong> {item.explanation}
                        </div>
                      )}
                    </>
                  )}

                  {quiz.type === 'fill_blank' && (
                    <>
                      <div className="quiz-item-question">{item.sentence}</div>
                      <div className="quiz-item-answer">
                        <strong>Answer:</strong> {item.answer}
                      </div>
                      {item.distractors && item.distractors.length > 0 && (
                        <div className="quiz-item-distractors">
                          <strong>Distractors:</strong> {item.distractors.join(', ')}
                        </div>
                      )}
                    </>
                  )}

                  {quiz.type === 'flashcard' && (
                    <>
                      <div className="flashcard-front">
                        <strong>Front:</strong> {item.front}
                      </div>
                      <div className="flashcard-back">
                        <strong>Back:</strong> {item.back}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="test-page-container">
      <div className="test-page-header">
        <h1>Quiz Generator Test</h1>
        <p>Test quiz generation with any content (no database required)</p>
      </div>

      <div className="test-page-content">
        {/* Content Input */}
        <div className="content-section">
          <label className="content-label">
            Paste Your Content Here
            <span className="content-hint">(Lecture notes, article, or any text)</span>
          </label>
          <textarea
            className="content-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your content here... The longer and more detailed, the better the quiz questions will be."
            rows={12}
          />
          <div className="content-stats">
            {content.length} characters
          </div>
        </div>

        {/* Quiz Settings */}
        <div className="quiz-settings-section">
          <h3>Quiz Settings</h3>
          
          <div className="quiz-settings-grid">
            {/* Quiz Type */}
            <div className="quiz-input-group" ref={quizTypeDropdownRef}>
              <label className="quiz-input-label">Type of Quiz</label>
              <div 
                className="quiz-dropdown-trigger"
                onClick={() => {
                  setQuizTypeDropdownOpen(!quizTypeDropdownOpen);
                  setDifficultyDropdownOpen(false);
                }}
              >
                <span className={!selectedQuizType ? "quiz-placeholder" : ""}>
                  {selectedQuizType ? quizTypes.find(qt => qt.value === selectedQuizType)?.label : "Select quiz type"}
                </span>
                <FaChevronDown className={`quiz-dropdown-icon ${quizTypeDropdownOpen ? 'open' : ''}`} />
              </div>
              {quizTypeDropdownOpen && (
                <div className="quiz-dropdown-menu">
                  {quizTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`quiz-dropdown-item ${selectedQuizType === type.value ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedQuizType(type.value);
                        setQuizTypeDropdownOpen(false);
                      }}
                    >
                      {type.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div className="quiz-input-group" ref={difficultyDropdownRef}>
              <label className="quiz-input-label">Difficulty</label>
              <div 
                className="quiz-dropdown-trigger"
                onClick={() => {
                  setDifficultyDropdownOpen(!difficultyDropdownOpen);
                  setQuizTypeDropdownOpen(false);
                }}
              >
                <span className={!selectedDifficulty ? "quiz-placeholder" : ""}>
                  {selectedDifficulty ? difficulties.find(d => d.value === selectedDifficulty)?.label : "Select difficulty"}
                </span>
                <FaChevronDown className={`quiz-dropdown-icon ${difficultyDropdownOpen ? 'open' : ''}`} />
              </div>
              {difficultyDropdownOpen && (
                <div className="quiz-dropdown-menu">
                  {difficulties.map((difficulty) => (
                    <div
                      key={difficulty.value}
                      className={`quiz-dropdown-item ${selectedDifficulty === difficulty.value ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDifficulty(difficulty.value);
                        setDifficultyDropdownOpen(false);
                      }}
                    >
                      {difficulty.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Number of Questions */}
            <div className="quiz-input-group">
              <label className="quiz-input-label">Number of Questions</label>
              <input
                type="number"
                className="quiz-text-input"
                value={selectedNumQuestions}
                onChange={(e) => setSelectedNumQuestions(parseInt(e.target.value) || '')}
                placeholder="Enter number (e.g., 5, 10, 20)"
                min="1"
                max="50"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button 
            className="generate-quiz-btn test-generate-btn" 
            onClick={handleGenerateQuiz}
            disabled={quizState.isGenerating}
          >
            {quizState.isGenerating ? (
              <>
                <FaSpinner className="spinner" /> Generating Quiz...
              </>
            ) : (
              'Generate Quiz'
            )}
          </button>

          {/* Error Message */}
          {quizState.error && (
            <div className="error-message">
              ⚠ {quizState.error}
            </div>
          )}
        </div>

        {/* Quiz Preview */}
        {renderQuizPreview()}
      </div>
    </div>
  );
}
