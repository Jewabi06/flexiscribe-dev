// Mock data for UI visualization
// This file acts as a placeholder until connected to the database

// Dashboard Stats
export const mockDashboardStats = {
  rank: "Ascendant",
  xp: 10543,
  xpProgress: 65, // percentage
  studyStreak: 7,
  streakIcon: "🔥",
  streakActive: true, // Whether streak is active today
  lastActivityDate: "2024-12-24", // Last date of activity
  streakHistory: [
    { date: "2024-12-24", activity: "quiz", completed: true },
    { date: "2024-12-23", activity: "reviewer", completed: true },
    { date: "2024-12-22", activity: "quiz", completed: true },
    { date: "2024-12-21", activity: "reviewer", completed: true },
    { date: "2024-12-20", activity: "quiz", completed: true },
    { date: "2024-12-19", activity: "quiz", completed: true },
    { date: "2024-12-18", activity: "reviewer", completed: true }
  ]
};

// Notifications Data
export const mockNotifications = [
  {
    id: 1,
    type: "reviewer",
    title: "New Reviewer Available",
    message: "Introduction to Computer Science reviewer has been uploaded",
    time: "5 minutes ago",
    read: false,
    link: "/student/reviewers"
  },
  {
    id: 2,
    type: "quiz",
    title: "New Quiz Available",
    message: "Data Structures Quiz is now available to take",
    time: "2 hours ago",
    read: false,
    link: "/student/quizzes"
  },
  {
    id: 3,
    type: "achievement",
    title: "Achievement Unlocked!",
    message: "You've earned the 'Week Warrior' badge for 7-day streak",
    time: "1 day ago",
    read: false,
    link: "/student/dashboard"
  },
  {
    id: 4,
    type: "reviewer",
    title: "Reviewer Updated",
    message: "Database Management reviewer has been updated with new content",
    time: "2 days ago",
    read: true,
    link: "/student/reviewers"
  }
];

// Mock data for enrolled classes and raw transcripts
export const enrolledClasses = [
  { id: 1, code: "CPP117", name: "Embedded Systems" }
];

export const rawTranscripts = [
  { id: 1, code: "CPP117", name: "Embedded Systems" }
];

// Mock reviewers by class code
export const mockReviewersByClass = {
  "CPP117": [
    {
      id: 1,
      title: "Periodic Interrupt, Waveform Generation, and Time Measurement",
      subject: "CPP117",
      description: "Comprehensive guide to timer-based interrupts and waveform generation techniques",
      uploadDate: "2024-12-20",
      lastUpdated: "2024-12-22",
      fileType: "PDF",
      fileSize: "2.4 MB",
      pages: 45
    },
    {
      id: 2,
      title: "Microcontroller Architecture and Assembly Programming",
      subject: "CPP117",
      description: "Deep dive into microcontroller internals and low-level programming",
      uploadDate: "2024-12-18",
      lastUpdated: "2024-12-21",
      fileType: "PDF",
      fileSize: "3.1 MB",
      pages: 62
    },
    {
      id: 3,
      title: "Embedded Systems Communication Protocols",
      subject: "CPP117",
      description: "I2C, SPI, UART and other communication protocols explained",
      uploadDate: "2024-12-15",
      lastUpdated: "2024-12-19",
      fileType: "PDF",
      fileSize: "1.8 MB",
      pages: 38
    }
  ]
};

// Mock raw transcripts by class code
export const mockTranscriptsByClass = {
  "CPP117": [
    {
      id: 1,
      title: "Lecture 1 - Introduction to Embedded Systems",
      subject: "CPP117",
      date: "2024-12-01",
      duration: "1h 30m",
      fileType: "DOCX",
      fileSize: "45 KB",
      status: "Processed"
    },
    {
      id: 2,
      title: "Lecture 2 - Timer and Counter Fundamentals",
      subject: "CPP117",
      date: "2024-12-05",
      duration: "2h 00m",
      fileType: "DOCX",
      fileSize: "58 KB",
      status: "Processed"
    },
    {
      id: 3,
      title: "Lecture 3 - Interrupt Handling Mechanisms",
      subject: "CPP117",
      date: "2024-12-08",
      duration: "1h 45m",
      fileType: "DOCX",
      fileSize: "52 KB",
      status: "Processed"
    }
  ]
};

// Reviewers Data
export const mockReviewers = [
  {
    id: 1,
    title: "Introduction to Computer Science",
    subject: "CS101",
    description: "Fundamental concepts of computer science and programming",
    uploadDate: "2024-12-20",
    lastUpdated: "2024-12-22",
    downloads: 145,
    views: 320
  },
  {
    id: 2,
    title: "Data Structures and Algorithms",
    subject: "CS102",
    description: "Common data structures and algorithmic approaches",
    uploadDate: "2024-12-18",
    lastUpdated: "2024-12-21",
    downloads: 230,
    views: 450
  },
  {
    id: 3,
    title: "Database Management Systems",
    subject: "CS201",
    description: "Relational databases, SQL, and database design principles",
    uploadDate: "2024-12-15",
    lastUpdated: "2024-12-23",
    downloads: 189,
    views: 380
  },
  {
    id: 4,
    title: "Web Development Fundamentals",
    subject: "CS202",
    description: "HTML, CSS, JavaScript, and modern web technologies",
    uploadDate: "2024-12-14",
    lastUpdated: "2024-12-20",
    downloads: 210,
    views: 420
  },
  {
    id: 5,
    title: "Object-Oriented Programming",
    subject: "CS103",
    description: "OOP concepts, design patterns, and best practices",
    uploadDate: "2024-12-12",
    lastUpdated: "2024-12-19",
    downloads: 175,
    views: 340
  },
  {
    id: 6,
    title: "Operating Systems",
    subject: "CS301",
    description: "OS concepts, process management, and memory management",
    uploadDate: "2024-12-10",
    lastUpdated: "2024-12-18",
    downloads: 156,
    views: 290
  },
  {
    id: 7,
    title: "Computer Networks",
    subject: "CS302",
    description: "Network protocols, architecture, and security",
    uploadDate: "2024-12-08",
    lastUpdated: "2024-12-17",
    downloads: 142,
    views: 270
  },
  {
    id: 8,
    title: "Software Engineering",
    subject: "CS303",
    description: "Software development lifecycle and engineering practices",
    uploadDate: "2024-12-05",
    lastUpdated: "2024-12-16",
    downloads: 167,
    views: 310
  }
];

// Quizzes Data
export const mockQuizzes = [
  {
    id: 1,
    title: "CS101 Midterm Quiz",
    subject: "CS101",
    description: "Test your knowledge on computer science fundamentals",
    totalQuestions: 25,
    duration: 30, // minutes
    difficulty: "Easy",
    passingScore: 70,
    attempts: 3,
    availableUntil: "2024-12-30"
  },
  {
    id: 2,
    title: "Data Structures Final Quiz",
    subject: "CS102",
    description: "Comprehensive quiz on data structures and algorithms",
    totalQuestions: 30,
    duration: 45,
    difficulty: "Hard",
    passingScore: 75,
    attempts: 2,
    availableUntil: "2024-12-28"
  },
  {
    id: 3,
    title: "Database Basics Quiz",
    subject: "CS201",
    description: "Quiz covering SQL and database design",
    totalQuestions: 20,
    duration: 25,
    difficulty: "Medium",
    passingScore: 70,
    attempts: 3,
    availableUntil: "2024-12-29"
  },
  {
    id: 4,
    title: "HTML & CSS Quiz",
    subject: "CS202",
    description: "Test your front-end development skills",
    totalQuestions: 15,
    duration: 20,
    difficulty: "Easy",
    passingScore: 65,
    attempts: 4,
    availableUntil: "2024-12-31"
  },
  {
    id: 5,
    title: "OOP Concepts Quiz",
    subject: "CS103",
    description: "Object-oriented programming principles and patterns",
    totalQuestions: 22,
    duration: 30,
    difficulty: "Medium",
    passingScore: 72,
    attempts: 3,
    availableUntil: "2024-12-27"
  },
  {
    id: 6,
    title: "Operating Systems Quiz",
    subject: "CS301",
    description: "OS concepts and system programming",
    totalQuestions: 28,
    duration: 40,
    difficulty: "Hard",
    passingScore: 75,
    attempts: 2,
    availableUntil: "2024-12-26"
  },
  {
    id: 7,
    title: "Networking Fundamentals Quiz",
    subject: "CS302",
    description: "Network protocols and architecture",
    totalQuestions: 24,
    duration: 35,
    difficulty: "Medium",
    passingScore: 70,
    attempts: 3,
    availableUntil: "2024-12-29"
  }
];

// Completed Quizzes (User's quiz history)
export const mockCompletedQuizzes = [
  {
    id: 1,
    lesson: "Periodic Interrupt, Waveform Generation, and Time Measurement",
    subject: "CPP117",
    quizType: "MCQ",
    numQuestions: 10,
    accuracy: 80,
    completedDate: "2024-12-28",
    lastAccessedDate: "2024-12-31T10:30:00",
    score: 8,
    totalScore: 10
  },
  {
    id: 2,
    lesson: "Data Acquisition, Control, Sensors, and Actuators",
    subject: "CPP117",
    quizType: "Fill-in",
    numQuestions: 20,
    accuracy: 90,
    completedDate: "2024-12-27",
    lastAccessedDate: "2024-12-30T15:20:00",
    score: 18,
    totalScore: 20
  },
  {
    id: 3,
    lesson: "Asynchronous Serial and Synchronous Serial Communication",
    subject: "CPP117",
    quizType: "Flashcard",
    numQuestions: 20,
    accuracy: 70,
    completedDate: "2024-12-26",
    lastAccessedDate: "2024-12-29T09:15:00",
    score: 14,
    totalScore: 20
  },
  {
    id: 4,
    lesson: "Microcontroller Architecture and Assembly Programming",
    subject: "CPP117",
    quizType: "MCQ",
    numQuestions: 15,
    accuracy: 85,
    completedDate: "2024-12-25",
    lastAccessedDate: "2024-12-28T14:45:00",
    score: 13,
    totalScore: 15
  },
  {
    id: 5,
    lesson: "Embedded Systems Communication Protocols",
    subject: "CPP117",
    quizType: "Fill-in",
    numQuestions: 12,
    accuracy: 75,
    completedDate: "2024-12-24",
    lastAccessedDate: "2024-12-27T11:30:00",
    score: 9,
    totalScore: 12
  }
];

// Quiz Questions Data (for different quiz types)
export const mockQuizQuestions = {
  // MCQ Quiz - Quiz ID 1
  1: {
    quizType: "MCQ",
    questions: [
      {
        id: 1,
        question: "What is polling?",
        options: [
          "state of continuous monitoring",
          "request generated by an instruction",
          "electronic alerting signal",
          "signal that temporarily halts CPU execution"
        ],
        correctAnswer: 0,
        hint: "Think about continuous checking of status"
      },
      {
        id: 2,
        question: "What does PWM stand for?",
        options: [
          "Power Wave Modulation",
          "Pulse Width Modulation",
          "Periodic Wave Management",
          "Power Width Management"
        ],
        correctAnswer: 1,
        hint: "It's a technique used to control analog circuits with digital outputs"
      },
      {
        id: 3,
        question: "Which timer mode is used for waveform generation?",
        options: [
          "Normal Mode",
          "CTC Mode",
          "Fast PWM Mode",
          "Phase Correct PWM Mode"
        ],
        correctAnswer: 2,
        hint: "This mode generates high-frequency PWM waveforms"
      }
    ]
  },
  // Fill-in Quiz - Quiz ID 2
  2: {
    quizType: "Fill-in",
    questions: [
      {
        id: 1,
        question: "An interrupt is a signal that __________ halts the CPU's normal execution to respond to an event.",
        correctAnswer: "temporarily",
        hint: "It's not permanent, just a brief pause"
      },
      {
        id: 2,
        question: "ADC stands for __________ to Digital Converter.",
        correctAnswer: "Analog",
        hint: "It converts continuous signals to discrete values"
      },
      {
        id: 3,
        question: "A __________ is a device that converts physical quantities into electrical signals.",
        correctAnswer: "sensor",
        hint: "These devices detect changes in the environment"
      }
    ]
  },
  // Flashcard Quiz - Quiz ID 3
  3: {
    quizType: "Flashcard",
    questions: [
      {
        id: 1,
        front: "PERIODIC INTERRUPT",
        back: "Events that occur at regular, fixed time intervals, triggered by a hardware timer.",
        hint: "Think about events happening at consistent intervals"
      },
      {
        id: 2,
        front: "ASYNCHRONOUS SERIAL",
        back: "Data transmission where each byte is sent independently with start and stop bits, without a shared clock signal.",
        hint: "Communication without a common timing reference"
      },
      {
        id: 3,
        front: "SYNCHRONOUS SERIAL",
        back: "Data transmission where data bits are sent in sync with a clock signal shared between devices.",
        hint: "Communication with a shared timing signal"
      }
    ]
  }
};

// Available Lessons for Quiz Generation
export const mockAvailableLessons = [
  { id: 1, title: "Periodic Interrupt, Waveform Generation, and Time Measurement", subject: "CPP117" },
  { id: 2, title: "Data Acquisition, Control, Sensors, and Actuators", subject: "CPP117" },
  { id: 3, title: "Asynchronous Serial and Synchronous Serial Communication", subject: "CPP117" },
  { id: 4, title: "Microcontroller Architecture and Assembly Programming", subject: "CPP117" },
  { id: 5, title: "Embedded Systems Communication Protocols", subject: "CPP117" },
  { id: 6, title: "Timer and Counter Fundamentals", subject: "CPP117" },
  { id: 7, title: "Interrupt Handling Mechanisms", subject: "CPP117" },
  { id: 8, title: "ADC and DAC Interfaces", subject: "CPP117" }
];

// Leaderboard Data
export const mockLeaderboard = [
  {
    rank: 1,
    username: "erunim",
    studentId: "2201000",
    xp: 10501,
    level: "Ascendant",
    streak: 20,
    quizzesTaken: 45,
    averageScore: 92
  },
  {
    rank: 2,
    username: "yuriTheGreat",
    studentId: "2201001",
    xp: 10000,
    level: "Peak Performer I",
    streak: 16,
    quizzesTaken: 42,
    averageScore: 89
  },
  {
    rank: 3,
    username: "bellaTrix",
    studentId: "2201002",
    xp: 8499,
    level: "Peak Performer V",
    streak: 14,
    quizzesTaken: 38,
    averageScore: 87
  },
  {
    rank: 4,
    username: "mollyMoon",
    studentId: "2201003",
    xp: 7500,
    level: "Mastery I",
    streak: 13,
    quizzesTaken: 28,
    averageScore: 85
  },
  {
    rank: 5,
    username: "ranNoir",
    studentId: "22041004",
    xp: 5999,
    level: "Mastery V",
    streak: 12,
    quizzesTaken: 25,
    averageScore: 83
  },
  {
    rank: 6,
    username: "monaLisa",
    studentId: "22041005",
    xp: 5100,
    level: "Self-Driven I",
    streak: 11,
    quizzesTaken: 23,
    averageScore: 80
  },
  {
    rank: 7,
    username: "skyWalker",
    studentId: "22041006",
    xp: 3899,
    level: "Self-Driven V",
    streak: 10,
    quizzesTaken: 21,
    averageScore: 78
  },
  {
    rank: 8,
    username: "shinObix",
    studentId: "22041007",
    xp: 3200,
    level: "Growth Seeker I",
    streak: 9,
    quizzesTaken: 19,
    averageScore: 76
  },
  {
    rank: 9,
    username: "margotRoux",
    studentId: "22041008",
    xp: 2299,
    level: "Growth Seeker V",
    streak: 8,
    quizzesTaken: 17,
    averageScore: 74
  },
  {
    rank: 10,
    username: "charlesX",
    studentId: "22041009",
    xp: 1800,
    level: "Habit Builder I",
    streak: 7,
    quizzesTaken: 15,
    averageScore: 72
  },
  {
    rank: 11,
    username: "lunaSky",
    studentId: "22041010",
    xp: 1000,
    level: "Habit Builder V",
    streak: 6,
    quizzesTaken: 13,
    averageScore: 70
  },
  {
    rank: 12,
    username: "novaStar",
    studentId: "22041011",
    xp: 800,
    level: "Learner I",
    streak: 5,
    quizzesTaken: 11,
    averageScore: 68
  },
  {
    rank: 13,
    username: "echoWave",
    studentId: "22041012",
    xp: 199,
    level: "Learner V",
    streak: 4,
    quizzesTaken: 9,
    averageScore: 66
  },
];

// Recent Activity
export const mockRecentActivity = [
  {
    id: 1,
    type: "quiz",
    title: "Completed Data Structures Quiz",
    score: 85,
    date: "2024-12-23",
    time: "14:30"
  },
  {
    id: 2,
    type: "reviewer",
    title: "Downloaded Web Development Reviewer",
    date: "2024-12-22",
    time: "10:15"
  },
  {
    id: 3,
    type: "achievement",
    title: "Earned 7-Day Streak Badge",
    date: "2024-12-21",
    time: "09:00"
  }
];

// Study Progress Data (for Jump Back In feature)
export const mockStudyProgress = [
  {
    id: 1,
    reviewerId: 1,
    reviewerTitle: "Introduction to Computer Science",
    subject: "CS101",
    progress: 90, // percentage
    lastStudied: "2024-12-24",
    lastStudiedTime: "15:30",
    currentSection: "Chapter 5: Algorithms",
    totalSections: 8,
    completedSections: 7,
    link: "/student/reviewers/1?section=5"
  },
  {
    id: 2,
    reviewerId: 2,
    reviewerTitle: "Data Structures and Algorithms",
    subject: "CS102",
    progress: 65,
    lastStudied: "2024-12-23",
    lastStudiedTime: "10:20",
    currentSection: "Chapter 3: Trees and Graphs",
    totalSections: 6,
    completedSections: 4,
    link: "/student/reviewers/2?section=3"
  },
  {
    id: 3,
    reviewerId: 3,
    reviewerTitle: "Database Management Systems",
    subject: "CS201",
    progress: 40,
    lastStudied: "2024-12-22",
    lastStudiedTime: "14:45",
    currentSection: "Chapter 2: SQL Queries",
    totalSections: 5,
    completedSections: 2,
    link: "/student/reviewers/3?section=2"
  }
];

// Rank System Data (Based on the ranking image provided)
export const mockRankSystem = {
  currentRank: {
    name: "Ascendant",
    level: 0, // 0-indexed, so Ascendant is the 7th rank tier
    tier: "VII",
    xp: 10543,
    xpMin: 10500,
    xpMax: 999999, // Max rank
    color: "#FF1493",
    icon: "/img/ascendant.png"
  },
  allRanks: [
    // Learner Tiers
    { name: "Learner I", tier: "I", xpMin: 800, xpMax: 999, color: "#CD7F32", icon: "/img/learner-1.png" },
    { name: "Learner II", tier: "II", xpMin: 600, xpMax: 799, color: "#CD7F32", icon: "/img/learner-2.png" },
    { name: "Learner III", tier: "III", xpMin: 400, xpMax: 599, color: "#CD7F32", icon: "/img/learner-3.png" },
    { name: "Learner IV", tier: "IV", xpMin: 200, xpMax: 399, color: "#CD7F32", icon: "/img/learner-4.png" },
    { name: "Learner V", tier: "V", xpMin: 0, xpMax: 199, color: "#CD7F32", icon: "/img/learner-5.png" },
    
    // Habit Builder Tiers
    { name: "Habit Builder I", tier: "I", xpMin: 1800, xpMax: 1999, color: "#C0C0C0", icon: "/img/habit-builder-1.png" },
    { name: "Habit Builder II", tier: "II", xpMin: 1600, xpMax: 1799, color: "#C0C0C0", icon: "/img/habit-builder-2.png" },
    { name: "Habit Builder III", tier: "III", xpMin: 1400, xpMax: 1599, color: "#C0C0C0", icon: "/img/habit-builder-3.png" },
    { name: "Habit Builder IV", tier: "IV", xpMin: 1200, xpMax: 1399, color: "#C0C0C0", icon: "/img/habit-builder-4.png" },
    { name: "Habit Builder V", tier: "V", xpMin: 1000, xpMax: 1199, color: "#C0C0C0", icon: "/img/habit-builder-5.png" },
    
    // Growth Seeker Tiers
    { name: "Growth Seeker I", tier: "I", xpMin: 3200, xpMax: 3499, color: "#FFD700", icon: "/img/growth-seeker-1.png" },
    { name: "Growth Seeker II", tier: "II", xpMin: 2900, xpMax: 3199, color: "#FFD700", icon: "/img/growth-seeker-2.png" },
    { name: "Growth Seeker III", tier: "III", xpMin: 2600, xpMax: 2899, color: "#FFD700", icon: "/img/growth-seeker-3.png" },
    { name: "Growth Seeker IV", tier: "IV", xpMin: 2300, xpMax: 2599, color: "#FFD700", icon: "/img/growth-seeker-4.png" },
    { name: "Growth Seeker V", tier: "V", xpMin: 2000, xpMax: 2299, color: "#FFD700", icon: "/img/growth-seeker-5.png" },
    
    // Self-Driven Tiers
    { name: "Self-Driven I", tier: "I", xpMin: 5100, xpMax: 5499, color: "#90EE90", icon: "/img/self-driven-1.png" },
    { name: "Self-Driven II", tier: "II", xpMin: 4700, xpMax: 5099, color: "#90EE90", icon: "/img/self-driven-2.png" },
    { name: "Self-Driven III", tier: "III", xpMin: 4300, xpMax: 4699, color: "#90EE90", icon: "/img/self-driven-3.png" },
    { name: "Self-Driven IV", tier: "IV", xpMin: 3900, xpMax: 4299, color: "#90EE90", icon: "/img/self-driven-4.png" },
    { name: "Self-Driven V", tier: "V", xpMin: 3500, xpMax: 3899, color: "#90EE90", icon: "/img/self-driven-5.png" },
    
    // Mastery Tiers
    { name: "Mastery I", tier: "I", xpMin: 7500, xpMax: 7999, color: "#9370DB", icon: "/img/mastery-1.png" },
    { name: "Mastery II", tier: "II", xpMin: 7000, xpMax: 7499, color: "#9370DB", icon: "/img/mastery-2.png" },
    { name: "Mastery III", tier: "III", xpMin: 6500, xpMax: 6999, color: "#9370DB", icon: "/img/mastery-3.png" },
    { name: "Mastery IV", tier: "IV", xpMin: 6000, xpMax: 6499, color: "#9370DB", icon: "/img/mastery-4.png" },
    { name: "Mastery V", tier: "V", xpMin: 5500, xpMax: 5999, color: "#9370DB", icon: "/img/mastery-5.png" },
    
    // Peak Performer Tiers
    { name: "Peak Performer I", tier: "I", xpMin: 10000, xpMax: 10499, color: "#00CED1", icon: "/img/peak-performer-1.png" },
    { name: "Peak Performer II", tier: "II", xpMin: 9500, xpMax: 9999, color: "#00CED1", icon: "/img/peak-performer-2.png" },
    { name: "Peak Performer III", tier: "III", xpMin: 9000, xpMax: 9499, color: "#00CED1", icon: "/img/peak-performer-3.png" },
    { name: "Peak Performer IV", tier: "IV", xpMin: 8500, xpMax: 8999, color: "#00CED1", icon: "/img/peak-performer-4.png" },
    { name: "Peak Performer V", tier: "V", xpMin: 8000, xpMax: 8499, color: "#00CED1", icon: "/img/peak-performer-5.png" },
    
    // Ascendant (Highest Rank)
    { name: "Ascendant", tier: "VII", xpMin: 10500, xpMax: 999999, color: "#FF1493", icon: "/img/ascendant.png" }
  ]
};

// Achievements/Badges
export const mockAchievements = [
  {
    id: 1,
    name: "Week Warrior",
    description: "Maintained a 7-day study streak",
    icon: "🔥",
    category: "Streak",
    earned: true,
    earnedDate: "2024-12-21",
    rarity: "common"
  },
  {
    id: 2,
    name: "Quiz Master",
    description: "Completed 25 quizzes",
    icon: "🎯",
    category: "Quiz",
    earned: true,
    earnedDate: "2024-12-18",
    rarity: "rare"
  },
  {
    id: 3,
    name: "Perfect Score",
    description: "Got 100% on any quiz",
    icon: "⭐",
    category: "Quiz",
    earned: false,
    earnedDate: null,
    rarity: "legendary"
  },
  {
    id: 4,
    name: "Knowledge Seeker",
    description: "Downloaded 10 reviewers",
    icon: "📚",
    category: "Reviewer",
    earned: true,
    earnedDate: "2024-12-15",
    rarity: "common"
  },
  {
    id: 5,
    name: "Early Bird",
    description: "Complete a quiz before 8 AM",
    icon: "🌅",
    category: "Special",
    earned: true,
    earnedDate: "2024-12-10",
    rarity: "uncommon"
  },
  {
    id: 6,
    name: "Night Owl",
    description: "Study after midnight",
    icon: "🦉",
    category: "Special",
    earned: false,
    earnedDate: null,
    rarity: "uncommon"
  },
  {
    id: 7,
    name: "Speed Demon",
    description: "Complete a quiz in under 5 minutes",
    icon: "⚡",
    category: "Quiz",
    earned: false,
    earnedDate: null,
    rarity: "rare"
  },
  {
    id: 8,
    name: "Consistency King",
    description: "Maintained a 30-day study streak",
    icon: "👑",
    category: "Streak",
    earned: false,
    earnedDate: null,
    rarity: "legendary"
  },
  {
    id: 9,
    name: "First Steps",
    description: "Complete your first quiz",
    icon: "👣",
    category: "Milestone",
    earned: true,
    earnedDate: "2024-11-28",
    rarity: "common"
  },
  {
    id: 10,
    name: "Bookworm",
    description: "Downloaded 50 reviewers",
    icon: "🐛",
    category: "Reviewer",
    earned: false,
    earnedDate: null,
    rarity: "epic"
  },
  {
    id: 11,
    name: "Social Butterfly",
    description: "Top 10 on the leaderboard",
    icon: "🦋",
    category: "Leaderboard",
    earned: true,
    earnedDate: "2024-12-20",
    rarity: "rare"
  },
  {
    id: 12,
    name: "Champion",
    description: "Reach #1 on the leaderboard",
    icon: "🏆",
    category: "Leaderboard",
    earned: false,
    earnedDate: null,
    rarity: "legendary"
  }
];

// Badges (Visual representations)
export const mockBadges = [
  {
    id: 1,
    name: "Bronze Star",
    description: "Reached Learner rank",
    icon: "⭐",
    color: "#CD7F32",
    earned: true,
    earnedDate: "2024-11-15"
  },
  {
    id: 2,
    name: "Silver Star",
    description: "Reached Habit Builder rank",
    icon: "⭐",
    color: "#C0C0C0",
    earned: true,
    earnedDate: "2024-11-25"
  },
  {
    id: 3,
    name: "Gold Star",
    description: "Reached Growth Seeker rank",
    icon: "⭐",
    color: "#FFD700",
    earned: true,
    earnedDate: "2024-12-05"
  },
  {
    id: 4,
    name: "Emerald Star",
    description: "Reached Self-Driven rank",
    icon: "⭐",
    color: "#90EE90",
    earned: true,
    earnedDate: "2024-12-12"
  },
  {
    id: 5,
    name: "Purple Star",
    description: "Reached Mastery rank",
    icon: "⭐",
    color: "#9370DB",
    earned: false,
    earnedDate: null
  },
  {
    id: 6,
    name: "Diamond Star",
    description: "Reached Peak Performer rank",
    icon: "⭐",
    color: "#00CED1",
    earned: false,
    earnedDate: null
  },
  {
    id: 7,
    name: "Legendary Star",
    description: "Reached Ascendant rank",
    icon: "⭐",
    color: "#FF1493",
    earned: true,
    earnedDate: "2024-12-22"
  }
];

// Search Data (Combined for search functionality)
export const mockSearchData = [
  // Reviewers for search
  ...mockReviewers.map(reviewer => ({
    id: `reviewer-${reviewer.id}`,
    type: "reviewer",
    title: reviewer.title,
    subject: reviewer.subject,
    link: `/student/reviewers/${reviewer.id}`
  })),
  // Quizzes for search
  ...mockQuizzes.map(quiz => ({
    id: `quiz-${quiz.id}`,
    type: "quiz",
    title: quiz.title,
    subject: quiz.subject,
    link: `/student/quizzes/${quiz.id}`
  }))
];

// Subject/Course List
export const mockSubjects = [
  { code: "CPP117", name: "Embedded Systems", semester: 1, year: 4 },
  { code: "CPP118", name: "Computer Architecture and Organization", semester: 1, year: 4 },
  { code: "CPP119", name: "Data Signal Processing", semester: 1, year: 4 },
  { code: "CPP120", name: "CpE Practice and Design 1", semester: 1, year: 4 },
  { code: "CPP121", name: "Fundamentals of Mixed Signals and Sensors", semester: 1, year: 4 },
  { code: "CPE102", name: "Network Embedded Systems", semester: 1, year: 4 },
  { code: "CPE103", name: "Mobile Embedded Systems", semester: 2, year: 4 },
  { code: "CPP122", name: "Cpe Practice and Design 2", semester: 2, year: 4 }
];

// Motivational Quotes (14 quotes for 2-week rotation)
export const mockQuotes = [
  {
    id: 1,
    text: "The beautiful thing about learning is nobody can take it away from you.",
    author: "B.B. King",
    emoji: "📚"
  },
  {
    id: 2,
    text: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
    emoji: "🌍"
  },
  {
    id: 3,
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    emoji: "💡"
  },
  {
    id: 4,
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
    emoji: "💪"
  },
  {
    id: 5,
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
    emoji: "✨"
  },
  {
    id: 6,
    text: "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence.",
    author: "Abigail Adams",
    emoji: "🎯"
  },
  {
    id: 7,
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
    emoji: "🌱"
  },
  {
    id: 8,
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
    emoji: "⏰"
  },
  {
    id: 9,
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
    emoji: "🚀"
  },
  {
    id: 10,
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    emoji: "🎬"
  },
  {
    id: 11,
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
    emoji: "🏆"
  },
  {
    id: 12,
    text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.",
    author: "Richard Feynman",
    emoji: "🔬"
  },
  {
    id: 13,
    text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
    author: "Brian Herbert",
    emoji: "🎁"
  },
  {
    id: 14,
    text: "The best way to predict your future is to create it.",
    author: "Abraham Lincoln",
    emoji: "📈"
  }
];

// Daily Welcome Messages (7 messages that rotate daily)
export const mockDailyMessages = [
  "Ready for another day of learning?",
  "Let's make today productive!",
  "Time to level up your knowledge!",
  "Every day is a chance to learn something new!",
  "Your future self will thank you for studying today!",
  "Knowledge is power - let's get started!",
  "Make today count - you've got this!"
];
