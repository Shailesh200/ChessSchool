/** Stable event names. Apps should not invent aliases. */

export const portfolioEvents = {
  ctaClick: 'cta_click',
  navClick: 'nav_click',
  projectOpen: 'project_open',
  outboundClick: 'outbound_click',
  gateEnter: 'gate_enter',
} as const

export const writesEvents = {
  postView: 'post_view',
  postRead: 'post_read',
  postComplete: 'post_complete',
  share: 'share',
  newsletterSubmit: 'newsletter_submit',
  clap: 'clap',
  search: 'search',
} as const

export const cardorbitEvents = {
  signup: 'signup',
  login: 'login',
  ctaClick: 'cta_click',
} as const

export const chessSchoolEvents = {
  signup: 'signup',
  login: 'login',
  logout: 'logout',
  onboardingComplete: 'onboarding_complete',
  enrollCtaClick: 'enroll_cta_click',
  placementStart: 'placement_start',
  placementComplete: 'placement_complete',
  lessonStart: 'lesson_start',
  lessonComplete: 'lesson_complete',
  examStart: 'exam_start',
  examComplete: 'exam_complete',
  classGraduate: 'class_graduate',
  homeworkStart: 'homework_start',
  homeworkComplete: 'homework_complete',
  matchStart: 'match_start',
  matchEnd: 'match_end',
  onlineGameCreate: 'online_game_create',
  onlineGameJoin: 'online_game_join',
  featureOpen: 'feature_open',
  thinkPuzzleResult: 'think_puzzle_result',
  sharePgn: 'share_pgn',
  searchOpen: 'search_open',
  searchResultOpen: 'search_result_open',
  journalReflection: 'journal_reflection',
  coachCharacterSelect: 'coach_character_select',
  pwaInstall: 'pwa_install',
  accountDelete: 'account_delete',
} as const
