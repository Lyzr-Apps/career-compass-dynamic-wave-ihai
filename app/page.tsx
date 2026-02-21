'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { FiHome, FiFileText, FiTarget, FiMap, FiMessageSquare, FiTrendingUp, FiChevronDown, FiChevronUp, FiCheck, FiBook, FiCode, FiAward, FiUsers, FiSend, FiPlay, FiSquare, FiRefreshCw, FiSave, FiActivity, FiAlertCircle, FiLoader, FiMenu, FiX } from 'react-icons/fi'

// --- Agent IDs ---
const RESUME_AGENT_ID = '69996b8b771423cce61cd10f'
const SKILL_GAP_AGENT_ID = '69996b9a82d9195c9e524bda'
const LEARNING_ROADMAP_AGENT_ID = '69996bac9f3636d6dd809807'
const INTERVIEW_AGENT_ID = '69996bc13f15947a386b5b94'
const PROGRESS_AGENT_ID = '69996bd682d9195c9e524be0'

// --- Agent Info ---
const AGENTS = [
  { id: RESUME_AGENT_ID, name: 'Resume Analyzer', purpose: 'Evaluates resume quality with section-by-section scoring' },
  { id: SKILL_GAP_AGENT_ID, name: 'Skill Gap Detector', purpose: 'Identifies missing skills against industry benchmarks' },
  { id: LEARNING_ROADMAP_AGENT_ID, name: 'Learning Roadmap', purpose: 'Generates weekly learning plans with milestones' },
  { id: INTERVIEW_AGENT_ID, name: 'Interview Simulator', purpose: 'Conducts adaptive mock interviews with feedback' },
  { id: PROGRESS_AGENT_ID, name: 'Progress Tracker', purpose: 'Compiles career readiness metrics and action plans' },
]

// --- TypeScript Interfaces ---
interface ResumeSection {
  name: string
  score: number
  feedback: string
  suggestions: string[]
}

interface ResumeResult {
  overall_score: number
  summary: string
  sections: ResumeSection[]
  strengths: string[]
  improvement_areas: string[]
}

interface SkillGap {
  skill_name: string
  current_level: string
  required_level: string
  category: string
  description: string
}

interface SkillGapResult {
  total_gaps: number
  critical_count: number
  important_count: number
  optional_count: number
  skill_gaps: SkillGap[]
  summary: string
  recommendations: string[]
}

interface Milestone {
  title: string
  type: string
  description: string
  priority: string
  completed: boolean
}

interface RoadmapWeek {
  week_number: number
  theme: string
  milestones: Milestone[]
}

interface RoadmapResult {
  total_weeks: number
  target_role: string
  overall_progress: number
  weeks: RoadmapWeek[]
  summary: string
}

interface InterviewFeedback {
  score: number
  strengths: string
  improvements: string
  ideal_answer: string
}

interface SessionSummary {
  total_questions: number
  average_score: number
  overall_feedback: string
  strengths_list: string[]
  improvement_areas: string[]
}

interface InterviewResult {
  type: string
  question: string
  question_number: number
  difficulty: string
  feedback: InterviewFeedback
  session_summary: SessionSummary
}

interface InterviewPerformance {
  sessions_completed: number
  average_score: number
  best_score: number
  trend: string
  summary: string
}

interface SkillProgress {
  skill_name: string
  before_level: string
  current_level: string
  status: string
}

interface ProgressResult {
  career_readiness_score: number
  resume_score: number
  skill_readiness_percentage: number
  interview_average: number
  plan_30_days: string[]
  plan_60_days: string[]
  plan_90_days: string[]
  interview_performance: InterviewPerformance
  skills_progress: SkillProgress[]
  overall_summary: string
}

interface ProfileData {
  name: string
  resumeText: string
  skills: string
  gpa: string
  targetRole: string
  interests: string
  graduationDate: string
}

interface ActivityEntry {
  timestamp: string
  action: string
  screen: string
}

interface InterviewMessage {
  role: 'ai' | 'user'
  content: string
  question_number?: number
  difficulty?: string
  feedback?: InterviewFeedback | null
}

// --- Helpers ---
function safeParseResult<T>(raw: unknown): T | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T } catch { return null }
  }
  return raw as T
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// --- Circular Score ---
function CircularScore({ score, maxScore = 100, size = 120, label }: { score: number | null; maxScore?: number; size?: number; label: string }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? (score / maxScore) * circumference : 0
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(20,18%,16%)" strokeWidth="8" />
          {score !== null && (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(36,60%,31%)" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-1000" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{score !== null ? score : '--'}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

// --- Skeleton Loader ---
function SkeletonBlock() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-3/4 bg-muted" />
      <Skeleton className="h-4 w-1/2 bg-muted" />
      <Skeleton className="h-20 w-full bg-muted" />
      <Skeleton className="h-4 w-2/3 bg-muted" />
    </div>
  )
}

// --- Error Banner ---
function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
      <FiAlertCircle className="w-5 h-5 text-[hsl(0,63%,45%)] flex-shrink-0" />
      <span className="text-sm flex-1">{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="border-destructive/30 text-foreground hover:bg-destructive/20">
          Retry
        </Button>
      )}
    </div>
  )
}

// --- Inline Status ---
function StatusMessage({ message, type }: { message: string; type: 'loading' | 'success' | 'error' }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${type === 'loading' ? 'bg-accent/10 text-accent-foreground' : type === 'success' ? 'bg-green-900/20 text-green-300' : 'bg-destructive/10 text-[hsl(0,63%,45%)]'}`}>
      {type === 'loading' && <FiLoader className="w-4 h-4 animate-spin" />}
      {type === 'success' && <FiCheck className="w-4 h-4" />}
      {type === 'error' && <FiAlertCircle className="w-4 h-4" />}
      {message}
    </div>
  )
}

// --- Milestone Type Icon ---
function MilestoneIcon({ type }: { type: string }) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('course') || t.includes('learn')) return <FiBook className="w-4 h-4" />
  if (t.includes('project') || t.includes('code')) return <FiCode className="w-4 h-4" />
  if (t.includes('cert')) return <FiAward className="w-4 h-4" />
  if (t.includes('hack') || t.includes('team') || t.includes('network')) return <FiUsers className="w-4 h-4" />
  return <FiBook className="w-4 h-4" />
}

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Sample Data ---
const SAMPLE_PROFILE: ProfileData = {
  name: 'Alex Chen',
  resumeText: 'Alex Chen\nSoftware Engineering Student\nUniversity of California, Berkeley\nGPA: 3.7\n\nSkills: Python, JavaScript, React, Node.js, SQL, Git\n\nExperience:\n- Software Engineering Intern at TechCorp (Summer 2024)\n  - Built REST APIs using Node.js and Express\n  - Implemented React dashboard for analytics\n  - Improved query performance by 40%\n\n- Teaching Assistant, CS 61A (Fall 2023)\n  - Led weekly discussion sections of 30 students\n  - Created practice problems and grading rubrics\n\nProjects:\n- TaskFlow: Full-stack task management app (React, Node.js, PostgreSQL)\n- MLPredictor: Machine learning model for stock prediction (Python, scikit-learn)\n\nEducation:\nBS Computer Science, UC Berkeley (Expected May 2025)',
  skills: 'Python, JavaScript, React, Node.js, SQL, Git, Machine Learning',
  gpa: '3.7',
  targetRole: 'Software Engineer',
  interests: 'Web Development, Machine Learning, Cloud Computing',
  graduationDate: '2025-05',
}

const SAMPLE_RESUME_RESULT: ResumeResult = {
  overall_score: 72,
  summary: 'Your resume demonstrates solid technical skills and relevant experience. The internship at TechCorp shows practical application of your skills. However, there are opportunities to strengthen impact metrics, add more technical depth, and improve formatting consistency.',
  sections: [
    { name: 'Contact & Header', score: 85, feedback: 'Clean and professional header with essential contact information.', suggestions: ['Add LinkedIn profile URL', 'Include a portfolio or GitHub link'] },
    { name: 'Experience', score: 70, feedback: 'Good internship experience with some quantifiable results. Could benefit from more specific metrics.', suggestions: ['Add more quantifiable achievements', 'Use stronger action verbs', 'Include technologies used in each bullet point'] },
    { name: 'Projects', score: 68, feedback: 'Projects show initiative but lack detail on technical challenges and outcomes.', suggestions: ['Add deployment links or GitHub repos', 'Describe technical challenges overcome', 'Include user/performance metrics'] },
    { name: 'Education', score: 80, feedback: 'Strong GPA and relevant coursework implied but not listed.', suggestions: ['List relevant coursework', 'Include honors or awards'] },
    { name: 'Skills', score: 65, feedback: 'Good foundation but missing some in-demand technologies for target role.', suggestions: ['Add cloud platforms (AWS/GCP)', 'Include testing frameworks', 'Add CI/CD tools'] },
  ],
  strengths: ['Relevant internship experience at a tech company', 'Strong GPA from a top university', 'Quantified at least one achievement (40% improvement)', 'Good mix of technical and leadership experience'],
  improvement_areas: ['Add more quantifiable metrics throughout', 'Include cloud and DevOps skills', 'Expand project descriptions with technical depth', 'Add a professional summary section'],
}

const SAMPLE_SKILL_GAP_RESULT: SkillGapResult = {
  total_gaps: 7,
  critical_count: 3,
  important_count: 2,
  optional_count: 2,
  skill_gaps: [
    { skill_name: 'System Design', current_level: 'Beginner', required_level: 'Intermediate', category: 'Critical', description: 'Understanding of distributed systems, load balancing, and scalability patterns is essential for SWE roles.' },
    { skill_name: 'Data Structures & Algorithms', current_level: 'Intermediate', required_level: 'Advanced', category: 'Critical', description: 'Whiteboard coding interviews require advanced DSA proficiency.' },
    { skill_name: 'Cloud Platforms (AWS/GCP)', current_level: 'None', required_level: 'Intermediate', category: 'Critical', description: 'Most companies require cloud deployment experience.' },
    { skill_name: 'Testing & QA', current_level: 'Beginner', required_level: 'Intermediate', category: 'Important', description: 'Unit testing, integration testing, and TDD practices.' },
    { skill_name: 'CI/CD Pipelines', current_level: 'None', required_level: 'Basic', category: 'Important', description: 'Familiarity with GitHub Actions, Jenkins, or similar tools.' },
    { skill_name: 'Docker & Containers', current_level: 'None', required_level: 'Basic', category: 'Optional', description: 'Containerization is increasingly expected for deployment.' },
    { skill_name: 'TypeScript', current_level: 'Beginner', required_level: 'Intermediate', category: 'Optional', description: 'TypeScript is becoming standard in modern web development.' },
  ],
  summary: 'You have 7 skill gaps for your target Software Engineer role. 3 are critical and should be prioritized immediately. Focus on System Design and DSA for interviews, and cloud platforms for practical readiness.',
  recommendations: ['Enroll in a System Design course (Grokking System Design)', 'Practice 2-3 LeetCode problems daily for DSA improvement', 'Complete AWS Cloud Practitioner certification', 'Build a project with CI/CD pipeline integration', 'Learn Docker basics through hands-on tutorials'],
}

const SAMPLE_ROADMAP_RESULT: RoadmapResult = {
  total_weeks: 8,
  target_role: 'Software Engineer',
  overall_progress: 0,
  weeks: [
    { week_number: 1, theme: 'DSA Foundations & Review', milestones: [
      { title: 'Complete Arrays & Strings module on LeetCode', type: 'Course', description: 'Solve 15 easy/medium problems focusing on arrays and string manipulation.', priority: 'High', completed: false },
      { title: 'Review Big-O notation and complexity analysis', type: 'Course', description: 'Refresh understanding of time and space complexity for all major data structures.', priority: 'High', completed: false },
    ]},
    { week_number: 2, theme: 'Trees, Graphs & Advanced DSA', milestones: [
      { title: 'Complete Trees & Graphs problems', type: 'Course', description: 'Solve 10 medium problems on binary trees, BSTs, and graph traversals.', priority: 'High', completed: false },
      { title: 'Study dynamic programming patterns', type: 'Course', description: 'Learn top-down and bottom-up DP approaches with 5 classic problems.', priority: 'High', completed: false },
    ]},
    { week_number: 3, theme: 'System Design Basics', milestones: [
      { title: 'Start Grokking System Design course', type: 'Course', description: 'Complete first 4 chapters covering scalability, load balancing, and caching.', priority: 'High', completed: false },
      { title: 'Design a URL Shortener', type: 'Project', description: 'Practice designing a URL shortener system end-to-end.', priority: 'Medium', completed: false },
    ]},
    { week_number: 4, theme: 'Cloud & AWS Fundamentals', milestones: [
      { title: 'AWS Cloud Practitioner prep', type: 'Certification', description: 'Study for AWS Cloud Practitioner exam covering core services.', priority: 'High', completed: false },
      { title: 'Deploy a project to AWS', type: 'Project', description: 'Deploy TaskFlow app using EC2, S3, and RDS.', priority: 'Medium', completed: false },
    ]},
    { week_number: 5, theme: 'Testing & CI/CD', milestones: [
      { title: 'Learn Jest & React Testing Library', type: 'Course', description: 'Write unit and integration tests for your React components.', priority: 'Medium', completed: false },
      { title: 'Set up GitHub Actions CI/CD', type: 'Project', description: 'Create automated build, test, and deploy pipeline.', priority: 'Medium', completed: false },
    ]},
    { week_number: 6, theme: 'Docker & Containerization', milestones: [
      { title: 'Docker fundamentals course', type: 'Course', description: 'Learn Docker basics: images, containers, Dockerfile, docker-compose.', priority: 'Medium', completed: false },
      { title: 'Containerize TaskFlow app', type: 'Project', description: 'Create Dockerfile and docker-compose for your full-stack app.', priority: 'Low', completed: false },
    ]},
    { week_number: 7, theme: 'Mock Interviews & Review', milestones: [
      { title: 'Complete 3 mock coding interviews', type: 'Project', description: 'Practice timed coding interviews with system design components.', priority: 'High', completed: false },
      { title: 'Review and refine resume', type: 'Course', description: 'Update resume with new skills, projects, and certifications.', priority: 'High', completed: false },
    ]},
    { week_number: 8, theme: 'Final Prep & Applications', milestones: [
      { title: 'Start applying to target companies', type: 'Project', description: 'Submit applications to 10+ companies with tailored resumes.', priority: 'High', completed: false },
      { title: 'Complete behavioral interview prep', type: 'Course', description: 'Prepare STAR stories for 8-10 common behavioral questions.', priority: 'High', completed: false },
    ]},
  ],
  summary: 'This 8-week roadmap prioritizes your critical skill gaps (DSA, System Design, Cloud) in the first 4 weeks, then builds supporting skills (Testing, Docker) and concludes with interview preparation and job applications.',
}

const SAMPLE_PROGRESS_RESULT: ProgressResult = {
  career_readiness_score: 62,
  resume_score: 72,
  skill_readiness_percentage: 55,
  interview_average: 68,
  plan_30_days: ['Complete DSA review and practice 50+ problems', 'Finish System Design fundamentals course', 'Update resume with quantifiable achievements'],
  plan_60_days: ['Obtain AWS Cloud Practitioner certification', 'Build CI/CD pipeline for portfolio project', 'Complete 5 mock interview sessions'],
  plan_90_days: ['Apply to 15+ target companies', 'Achieve 80+ average on mock interviews', 'Complete Docker containerization of portfolio'],
  interview_performance: { sessions_completed: 3, average_score: 68, best_score: 78, trend: 'Improving', summary: 'Performance is trending upward. Strong on behavioral questions, needs improvement on system design responses.' },
  skills_progress: [
    { skill_name: 'Data Structures & Algorithms', before_level: 'Intermediate', current_level: 'Intermediate-Advanced', status: 'Improving' },
    { skill_name: 'System Design', before_level: 'Beginner', current_level: 'Beginner-Intermediate', status: 'Improving' },
    { skill_name: 'Cloud Platforms', before_level: 'None', current_level: 'Beginner', status: 'Started' },
    { skill_name: 'Testing & QA', before_level: 'Beginner', current_level: 'Beginner', status: 'Not Started' },
    { skill_name: 'CI/CD', before_level: 'None', current_level: 'None', status: 'Not Started' },
  ],
  overall_summary: 'You are making good progress toward your Software Engineer career goal. Your resume is above average, and your DSA skills are improving. Focus on accelerating cloud platform learning and begin systematic interview preparation to reach your 90-day targets.',
}

// --- Navigation Items ---
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: FiHome },
  { key: 'resume', label: 'Resume Analysis', icon: FiFileText },
  { key: 'skills', label: 'Skill Gaps', icon: FiTarget },
  { key: 'roadmap', label: 'Learning Roadmap', icon: FiMap },
  { key: 'interview', label: 'Mock Interview', icon: FiMessageSquare },
  { key: 'progress', label: 'Progress', icon: FiTrendingUp },
]

const TARGET_ROLES = [
  'Software Engineer', 'Data Scientist', 'Product Manager', 'UX Designer',
  'DevOps Engineer', 'Full Stack Developer', 'Machine Learning Engineer', 'Business Analyst',
]

// ========== MAIN PAGE ==========
export default function Page() {
  // --- Navigation State ---
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSampleData, setShowSampleData] = useState(false)

  // --- Profile State ---
  const [profile, setProfile] = useState<ProfileData>({
    name: '', resumeText: '', skills: '', gpa: '', targetRole: '', interests: '', graduationDate: '',
  })
  const [profileSaved, setProfileSaved] = useState(false)

  // --- Agent Results ---
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null)
  const [skillGapResult, setSkillGapResult] = useState<SkillGapResult | null>(null)
  const [roadmapResult, setRoadmapResult] = useState<RoadmapResult | null>(null)
  const [progressResult, setProgressResult] = useState<ProgressResult | null>(null)

  // --- Loading / Error ---
  const [loadingAgent, setLoadingAgent] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // --- Interview State ---
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([])
  const [interviewActive, setInterviewActive] = useState(false)
  const [interviewAnswer, setInterviewAnswer] = useState('')
  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null)
  const [interviewSummary, setInterviewSummary] = useState<SessionSummary | null>(null)
  const [interviewStats, setInterviewStats] = useState({ questionsAsked: 0, avgScore: 0, currentDifficulty: '' })

  // --- Roadmap Local State ---
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [completedMilestones, setCompletedMilestones] = useState<Record<string, boolean>>({})

  // --- Skill Gap Filter ---
  const [skillFilter, setSkillFilter] = useState('All')

  // --- Activity Feed ---
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

  // --- Chat scroll ref ---
  const chatEndRef = useRef<HTMLDivElement>(null)

  // --- Mount: load from localStorage ---
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('career_mentor_profile')
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile)
        setProfile(parsed)
        setProfileSaved(true)
      }
      const savedMilestones = localStorage.getItem('career_mentor_milestones')
      if (savedMilestones) setCompletedMilestones(JSON.parse(savedMilestones))
      const savedActivity = localStorage.getItem('career_mentor_activity')
      if (savedActivity) setActivityLog(JSON.parse(savedActivity))
    } catch { /* ignore parse errors */ }
  }, [])

  // --- Auto-scroll chat ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [interviewMessages])

  // --- Save milestones to localStorage ---
  useEffect(() => {
    localStorage.setItem('career_mentor_milestones', JSON.stringify(completedMilestones))
  }, [completedMilestones])

  // --- Activity Logger ---
  const logActivity = useCallback((action: string, screen: string) => {
    const entry: ActivityEntry = { timestamp: new Date().toISOString(), action, screen }
    setActivityLog(prev => {
      const updated = [entry, ...prev].slice(0, 20)
      localStorage.setItem('career_mentor_activity', JSON.stringify(updated))
      return updated
    })
  }, [])

  // --- Save Profile ---
  const handleSaveProfile = () => {
    localStorage.setItem('career_mentor_profile', JSON.stringify(profile))
    setProfileSaved(true)
    logActivity('Saved profile', 'Dashboard')
  }

  // --- Resume Analysis ---
  const handleAnalyzeResume = async () => {
    if (!profile.resumeText.trim()) {
      setError('Please enter your resume text first.')
      return
    }
    setLoadingAgent('resume')
    setActiveAgentId(RESUME_AGENT_ID)
    setError(null)
    try {
      const message = `Analyze this resume for a ${profile.targetRole || 'Software Engineer'} position. Resume:\n\n${profile.resumeText}`
      const result = await callAIAgent(message, RESUME_AGENT_ID)
      if (result.success) {
        const data = safeParseResult<ResumeResult>(result?.response?.result)
        if (data) {
          setResumeResult(data)
          logActivity(`Resume analyzed - Score: ${data.overall_score ?? 'N/A'}`, 'Resume Analysis')
        } else {
          setError('Could not parse resume analysis results.')
        }
      } else {
        setError(result?.error ?? 'Failed to analyze resume.')
      }
    } catch (e) {
      setError('An unexpected error occurred during resume analysis.')
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Skill Gap Detection ---
  const handleDetectSkillGaps = async () => {
    setLoadingAgent('skills')
    setActiveAgentId(SKILL_GAP_AGENT_ID)
    setError(null)
    try {
      const message = `Detect skill gaps for a ${profile.targetRole || 'Software Engineer'} role. My current skills: ${profile.skills || 'Not specified'}. My resume: ${profile.resumeText || 'Not provided'}.`
      const result = await callAIAgent(message, SKILL_GAP_AGENT_ID)
      if (result.success) {
        const data = safeParseResult<SkillGapResult>(result?.response?.result)
        if (data) {
          setSkillGapResult(data)
          logActivity(`Skill gaps detected - ${data.total_gaps ?? 0} gaps found`, 'Skill Gaps')
        } else {
          setError('Could not parse skill gap results.')
        }
      } else {
        setError(result?.error ?? 'Failed to detect skill gaps.')
      }
    } catch {
      setError('An unexpected error occurred during skill gap detection.')
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Learning Roadmap ---
  const handleGenerateRoadmap = async () => {
    setLoadingAgent('roadmap')
    setActiveAgentId(LEARNING_ROADMAP_AGENT_ID)
    setError(null)
    try {
      const message = `Generate a learning roadmap for a ${profile.targetRole || 'Software Engineer'} role. My skills: ${profile.skills || 'Not specified'}. Graduation: ${profile.graduationDate || 'Not specified'}. Interests: ${profile.interests || 'Not specified'}.`
      const result = await callAIAgent(message, LEARNING_ROADMAP_AGENT_ID)
      if (result.success) {
        const data = safeParseResult<RoadmapResult>(result?.response?.result)
        if (data) {
          setRoadmapResult(data)
          setSelectedWeek(0)
          logActivity(`Roadmap generated - ${data.total_weeks ?? 0} weeks`, 'Learning Roadmap')
        } else {
          setError('Could not parse roadmap results.')
        }
      } else {
        setError(result?.error ?? 'Failed to generate roadmap.')
      }
    } catch {
      setError('An unexpected error occurred during roadmap generation.')
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Interview Start ---
  const handleStartInterview = async () => {
    const sid = 'interview_' + Date.now()
    setInterviewSessionId(sid)
    setInterviewMessages([])
    setInterviewSummary(null)
    setInterviewActive(true)
    setInterviewStats({ questionsAsked: 0, avgScore: 0, currentDifficulty: '' })
    setLoadingAgent('interview')
    setActiveAgentId(INTERVIEW_AGENT_ID)
    setError(null)
    try {
      const message = `Start interview for ${profile.targetRole || 'Software Engineer'}. My resume: ${profile.resumeText || 'Not provided'}. My skills: ${profile.skills || 'Not specified'}.`
      const result = await callAIAgent(message, INTERVIEW_AGENT_ID, { session_id: sid })
      if (result.success) {
        const data = safeParseResult<InterviewResult>(result?.response?.result)
        if (data && data.question) {
          setInterviewMessages([{
            role: 'ai',
            content: data.question,
            question_number: data.question_number ?? 1,
            difficulty: data.difficulty ?? 'Medium',
            feedback: null,
          }])
          setInterviewStats(prev => ({
            ...prev,
            questionsAsked: data.question_number ?? 1,
            currentDifficulty: data.difficulty ?? 'Medium',
          }))
          logActivity('Started mock interview session', 'Mock Interview')
        }
      } else {
        setError(result?.error ?? 'Failed to start interview.')
        setInterviewActive(false)
      }
    } catch {
      setError('An unexpected error occurred starting the interview.')
      setInterviewActive(false)
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Interview Submit Answer ---
  const handleSubmitAnswer = async () => {
    if (!interviewAnswer.trim() || !interviewSessionId) return
    const userMsg: InterviewMessage = { role: 'user', content: interviewAnswer }
    setInterviewMessages(prev => [...prev, userMsg])
    const answer = interviewAnswer
    setInterviewAnswer('')
    setLoadingAgent('interview')
    setActiveAgentId(INTERVIEW_AGENT_ID)
    setError(null)
    try {
      const result = await callAIAgent(answer, INTERVIEW_AGENT_ID, { session_id: interviewSessionId })
      if (result.success) {
        const data = safeParseResult<InterviewResult>(result?.response?.result)
        if (data) {
          if (data.type === 'summary' && data.session_summary) {
            setInterviewSummary(data.session_summary)
            setInterviewActive(false)
            logActivity(`Interview completed - Avg score: ${data.session_summary?.average_score ?? 'N/A'}`, 'Mock Interview')
          } else {
            const aiMsg: InterviewMessage = {
              role: 'ai',
              content: data.question ?? '',
              question_number: data.question_number,
              difficulty: data.difficulty,
              feedback: data.feedback ?? null,
            }
            setInterviewMessages(prev => [...prev, aiMsg])
            const scores = [...interviewMessages, userMsg, aiMsg]
              .filter(m => m.role === 'ai' && m.feedback?.score)
              .map(m => m.feedback?.score ?? 0)
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
            setInterviewStats({
              questionsAsked: data.question_number ?? interviewStats.questionsAsked + 1,
              avgScore,
              currentDifficulty: data.difficulty ?? interviewStats.currentDifficulty,
            })
          }
        }
      } else {
        setError(result?.error ?? 'Failed to get interview response.')
      }
    } catch {
      setError('An unexpected error occurred during interview.')
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- End Interview ---
  const handleEndInterview = async () => {
    if (!interviewSessionId) return
    setLoadingAgent('interview')
    setActiveAgentId(INTERVIEW_AGENT_ID)
    try {
      const result = await callAIAgent('end session', INTERVIEW_AGENT_ID, { session_id: interviewSessionId })
      if (result.success) {
        const data = safeParseResult<InterviewResult>(result?.response?.result)
        if (data?.session_summary) {
          setInterviewSummary(data.session_summary)
          logActivity(`Interview ended - Avg score: ${data.session_summary?.average_score ?? 'N/A'}`, 'Mock Interview')
        }
      }
    } catch { /* ignore */ }
    setInterviewActive(false)
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Refresh Progress ---
  const handleRefreshProgress = async () => {
    setLoadingAgent('progress')
    setActiveAgentId(PROGRESS_AGENT_ID)
    setError(null)
    try {
      const message = `Track my career preparation progress. Target role: ${profile.targetRole || 'Software Engineer'}. Resume: ${profile.resumeText || 'Not provided'}. Skills: ${profile.skills || 'Not specified'}. Resume score: ${resumeResult?.overall_score ?? 'unknown'}. Skill gaps found: ${skillGapResult?.total_gaps ?? 'unknown'}. Interview sessions: ${interviewStats.questionsAsked > 0 ? 'completed' : 'none yet'}.`
      const result = await callAIAgent(message, PROGRESS_AGENT_ID)
      if (result.success) {
        const data = safeParseResult<ProgressResult>(result?.response?.result)
        if (data) {
          setProgressResult(data)
          logActivity('Progress dashboard refreshed', 'Progress')
        } else {
          setError('Could not parse progress results.')
        }
      } else {
        setError(result?.error ?? 'Failed to refresh progress.')
      }
    } catch {
      setError('An unexpected error occurred refreshing progress.')
    }
    setLoadingAgent(null)
    setActiveAgentId(null)
  }

  // --- Toggle Milestone ---
  const toggleMilestone = (weekNum: number, milestoneIdx: number) => {
    const key = `w${weekNum}_m${milestoneIdx}`
    setCompletedMilestones(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // --- Effective Data (sample vs real) ---
  const effectiveResume = showSampleData ? SAMPLE_RESUME_RESULT : resumeResult
  const effectiveSkillGap = showSampleData ? SAMPLE_SKILL_GAP_RESULT : skillGapResult
  const effectiveRoadmap = showSampleData ? SAMPLE_ROADMAP_RESULT : roadmapResult
  const effectiveProgress = showSampleData ? SAMPLE_PROGRESS_RESULT : progressResult
  const effectiveProfile = showSampleData && !profileSaved ? SAMPLE_PROFILE : profile

  // --- Quick Scores ---
  const resumeScore = effectiveResume?.overall_score ?? null
  const skillReadiness = effectiveProgress?.skill_readiness_percentage ?? (effectiveSkillGap ? Math.round(100 - (effectiveSkillGap.critical_count ?? 0) * 15) : null)
  const careerReadiness = effectiveProgress?.career_readiness_score ?? null
  const interviewAvg = effectiveProgress?.interview_average ?? (interviewStats.avgScore > 0 ? interviewStats.avgScore : null)

  // ============================================
  // RENDER: Dashboard Screen
  // ============================================
  function renderDashboard() {
    const p = effectiveProfile
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold">Welcome{p.name ? `, ${p.name}` : ''}</h2>
            <p className="text-muted-foreground text-sm mt-1">Set up your profile to get personalized career guidance</p>
          </div>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Profile Setup</CardTitle>
            <CardDescription>Complete your profile to power all AI agents with your context</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Resume */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                  <Input id="name" placeholder="Your full name" value={profile.name} onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label htmlFor="resume" className="text-sm font-medium">Resume Text</Label>
                  <Textarea id="resume" placeholder="Paste your full resume text here..." rows={12} value={profile.resumeText} onChange={(e) => setProfile(prev => ({ ...prev, resumeText: e.target.value }))} className="mt-1 bg-secondary border-border font-mono text-xs" />
                </div>
              </div>
              {/* Right: Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="skills" className="text-sm font-medium">Skills (comma separated)</Label>
                  <Input id="skills" placeholder="Python, JavaScript, React..." value={profile.skills} onChange={(e) => setProfile(prev => ({ ...prev, skills: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label htmlFor="gpa" className="text-sm font-medium">GPA (0-4)</Label>
                  <Input id="gpa" type="number" min="0" max="4" step="0.1" placeholder="3.5" value={profile.gpa} onChange={(e) => setProfile(prev => ({ ...prev, gpa: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label htmlFor="target-role" className="text-sm font-medium">Target Role</Label>
                  <select id="target-role" value={profile.targetRole} onChange={(e) => setProfile(prev => ({ ...prev, targetRole: e.target.value }))} className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                    <option value="">Select a role...</option>
                    {TARGET_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="interests" className="text-sm font-medium">Interests (comma separated)</Label>
                  <Input id="interests" placeholder="Web Dev, AI, Cloud..." value={profile.interests} onChange={(e) => setProfile(prev => ({ ...prev, interests: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label htmlFor="grad" className="text-sm font-medium">Expected Graduation</Label>
                  <Input id="grad" type="month" value={profile.graduationDate} onChange={(e) => setProfile(prev => ({ ...prev, graduationDate: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={handleSaveProfile} className="bg-accent text-accent-foreground hover:bg-accent/80">
                <FiSave className="w-4 h-4 mr-2" /> Save Profile
              </Button>
              {profileSaved && <StatusMessage message="Profile saved successfully" type="success" />}
            </div>
          </CardContent>
        </Card>

        {/* Score Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <CircularScore score={resumeScore} size={90} label="Resume Score" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <CircularScore score={skillReadiness} size={90} label="Skill Readiness" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <CircularScore score={careerReadiness} size={90} label="Career Readiness" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <CircularScore score={interviewAvg} size={90} label="Interview Avg" />
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2"><FiActivity className="w-4 h-4" /> Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 && !showSampleData ? (
              <p className="text-muted-foreground text-sm">No activity yet. Start by analyzing your resume or detecting skill gaps.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(showSampleData && activityLog.length === 0 ? [
                  { timestamp: new Date().toISOString(), action: 'Resume analyzed - Score: 72', screen: 'Resume Analysis' },
                  { timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'Skill gaps detected - 7 gaps found', screen: 'Skill Gaps' },
                  { timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'Saved profile', screen: 'Dashboard' },
                ] : activityLog).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50 text-sm">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className="flex-1">{entry.action}</span>
                    <Badge variant="secondary" className="text-xs">{entry.screen}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================
  // RENDER: Resume Analysis Screen
  // ============================================
  function renderResumeAnalysis() {
    const data = effectiveResume
    const sections = Array.isArray(data?.sections) ? data.sections : []
    const strengths = Array.isArray(data?.strengths) ? data.strengths : []
    const improvements = Array.isArray(data?.improvement_areas) ? data.improvement_areas : []

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold">Resume Analysis</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Resume Input */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-base">Your Resume</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea placeholder="Paste your resume text here..." rows={18} value={profile.resumeText} onChange={(e) => setProfile(prev => ({ ...prev, resumeText: e.target.value }))} className="bg-secondary border-border font-mono text-xs" />
                <Button onClick={handleAnalyzeResume} disabled={loadingAgent === 'resume'} className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/80">
                  {loadingAgent === 'resume' ? <><FiLoader className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><FiFileText className="w-4 h-4 mr-2" /> Analyze Resume</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-3 space-y-4">
            {error && activeScreen === 'resume' && <ErrorBanner message={error} onRetry={handleAnalyzeResume} />}

            {loadingAgent === 'resume' ? (
              <Card><CardContent className="pt-6"><SkeletonBlock /><SkeletonBlock /></CardContent></Card>
            ) : data ? (
              <>
                {/* Overall Score */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-6">
                      <CircularScore score={data.overall_score ?? null} size={130} label="Overall Score" />
                      <div className="flex-1">
                        <h3 className="font-serif font-semibold text-lg mb-2">Summary</h3>
                        <div className="text-sm text-muted-foreground">{renderMarkdown(data.summary ?? '')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sections Accordion */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-base">Section Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sections.map((sec, i) => (
                      <SectionAccordion key={i} section={sec} />
                    ))}
                  </CardContent>
                </Card>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif text-base text-green-400">Strengths</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <FiCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif text-base text-[hsl(36,60%,50%)]">Areas to Improve</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {improvements.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <FiAlertCircle className="w-4 h-4 text-[hsl(36,60%,50%)] flex-shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <FiFileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">Click "Analyze Resume" to get your score and personalized feedback.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Section Accordion Sub-component ---
  function SectionAccordion({ section }: { section: ResumeSection }) {
    const [open, setOpen] = useState(false)
    const suggestions = Array.isArray(section?.suggestions) ? section.suggestions : []
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 rounded-md bg-secondary/50 hover:bg-secondary transition-colors text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm">{section?.name ?? 'Section'}</span>
              <Badge variant="secondary" className="text-xs">{section?.score ?? 0}/100</Badge>
            </div>
            {open ? <FiChevronUp className="w-4 h-4 text-muted-foreground" /> : <FiChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 space-y-3 border-l-2 border-accent/30 ml-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <Progress value={section?.score ?? 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground font-medium">{section?.score ?? 0}%</span>
            </div>
            <p className="text-sm text-muted-foreground">{section?.feedback ?? ''}</p>
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-accent-foreground mb-1">Suggestions:</p>
                <ul className="space-y-1">
                  {suggestions.map((sug, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">-</span> {sug}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // ============================================
  // RENDER: Skill Gaps Screen
  // ============================================
  function renderSkillGaps() {
    const data = effectiveSkillGap
    const allGaps = Array.isArray(data?.skill_gaps) ? data.skill_gaps : []
    const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : []
    const filteredGaps = skillFilter === 'All' ? allGaps : allGaps.filter(g => (g?.category ?? '').toLowerCase() === skillFilter.toLowerCase())

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold">Skill Gap Analysis</h2>
          <Button onClick={handleDetectSkillGaps} disabled={loadingAgent === 'skills'} className="bg-accent text-accent-foreground hover:bg-accent/80">
            {loadingAgent === 'skills' ? <><FiLoader className="w-4 h-4 mr-2 animate-spin" /> Detecting...</> : <><FiTarget className="w-4 h-4 mr-2" /> Detect Skill Gaps</>}
          </Button>
        </div>

        {error && activeScreen === 'skills' && <ErrorBanner message={error} onRetry={handleDetectSkillGaps} />}

        {loadingAgent === 'skills' ? (
          <Card><CardContent className="pt-6"><SkeletonBlock /><SkeletonBlock /></CardContent></Card>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-[hsl(0,63%,31%)]/30">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-[hsl(0,63%,45%)]">{data.critical_count ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">Critical</p>
                </CardContent>
              </Card>
              <Card className="border-accent/30">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-[hsl(36,60%,50%)]">{data.important_count ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">Important</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-muted-foreground">{data.optional_count ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">Optional</p>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            {data.summary && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{renderMarkdown(data.summary)}</div>
                </CardContent>
              </Card>
            )}

            {/* Filter Toggles */}
            <div className="flex gap-2">
              {['All', 'Critical', 'Important', 'Optional'].map(f => (
                <Button key={f} variant={skillFilter === f ? 'default' : 'secondary'} size="sm" onClick={() => setSkillFilter(f)} className={skillFilter === f ? 'bg-accent text-accent-foreground' : ''}>
                  {f} {f !== 'All' && <span className="ml-1 text-xs">({f === 'Critical' ? data.critical_count ?? 0 : f === 'Important' ? data.important_count ?? 0 : data.optional_count ?? 0})</span>}
                </Button>
              ))}
            </div>

            {/* Skill Gaps Table */}
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted-foreground">Skill</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground">Current Level</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground">Required Level</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGaps.map((gap, i) => {
                        const cat = (gap?.category ?? '').toLowerCase()
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="p-3 font-medium">{gap?.skill_name ?? 'Unknown'}</td>
                            <td className="p-3 text-muted-foreground">{gap?.current_level ?? 'N/A'}</td>
                            <td className="p-3 text-muted-foreground">{gap?.required_level ?? 'N/A'}</td>
                            <td className="p-3">
                              <Badge variant={cat === 'critical' ? 'destructive' : cat === 'important' ? 'default' : 'secondary'} className={cat === 'important' ? 'bg-accent text-accent-foreground' : ''}>
                                {gap?.category ?? 'Unknown'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-accent font-bold mt-0.5">{i + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FiTarget className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Click "Detect Skill Gaps" to compare your skills against industry requirements.</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ============================================
  // RENDER: Learning Roadmap Screen
  // ============================================
  function renderRoadmap() {
    const data = effectiveRoadmap
    const weeks = Array.isArray(data?.weeks) ? data.weeks : []
    const currentWeek = weeks[selectedWeek] ?? null
    const currentMilestones = Array.isArray(currentWeek?.milestones) ? currentWeek.milestones : []

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold">Learning Roadmap</h2>
            {data?.target_role && <p className="text-sm text-muted-foreground mt-1">Target: {data.target_role}</p>}
          </div>
          <Button onClick={handleGenerateRoadmap} disabled={loadingAgent === 'roadmap'} className="bg-accent text-accent-foreground hover:bg-accent/80">
            {loadingAgent === 'roadmap' ? <><FiLoader className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><FiMap className="w-4 h-4 mr-2" /> Generate Roadmap</>}
          </Button>
        </div>

        {error && activeScreen === 'roadmap' && <ErrorBanner message={error} onRetry={handleGenerateRoadmap} />}

        {loadingAgent === 'roadmap' ? (
          <Card><CardContent className="pt-6"><SkeletonBlock /><SkeletonBlock /></CardContent></Card>
        ) : data && weeks.length > 0 ? (
          <>
            {/* Progress Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{data.total_weeks ?? 0} weeks total</span>
                </div>
                <Progress value={data.overall_progress ?? 0} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">{data.overall_progress ?? 0}% complete</p>
              </CardContent>
            </Card>

            {/* Summary */}
            {data.summary && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{renderMarkdown(data.summary)}</div>
                </CardContent>
              </Card>
            )}

            {/* Week Timeline */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {weeks.map((w, i) => {
                const wMilestones = Array.isArray(w?.milestones) ? w.milestones : []
                const completedCount = wMilestones.filter((_, mi) => completedMilestones[`w${w?.week_number ?? i}_m${mi}`]).length
                const allDone = wMilestones.length > 0 && completedCount === wMilestones.length
                return (
                  <button key={i} onClick={() => setSelectedWeek(i)} className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-all ${selectedWeek === i ? 'border-accent bg-accent/10' : 'border-border bg-secondary/30 hover:bg-secondary/60'}`}>
                    <span className={`text-xs font-medium ${selectedWeek === i ? 'text-accent-foreground' : 'text-muted-foreground'}`}>Week {w?.week_number ?? i + 1}</span>
                    {allDone && <FiCheck className="w-3 h-3 text-green-400" />}
                  </button>
                )
              })}
            </div>

            {/* Selected Week Detail */}
            {currentWeek && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Week {currentWeek.week_number}: {currentWeek.theme ?? 'No theme'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentMilestones.map((milestone, mi) => {
                    const key = `w${currentWeek.week_number ?? selectedWeek}_m${mi}`
                    const isDone = completedMilestones[key] ?? false
                    return (
                      <div key={mi} className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${isDone ? 'bg-green-900/10 border-green-900/30' : 'bg-secondary/30 border-border'}`}>
                        <button onClick={() => toggleMilestone(currentWeek.week_number ?? selectedWeek, mi)} className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone ? 'bg-green-600 border-green-600' : 'border-muted-foreground/30 hover:border-accent'}`}>
                          {isDone && <FiCheck className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <MilestoneIcon type={milestone?.type ?? ''} />
                            <span className={`font-medium text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>{milestone?.title ?? 'Untitled'}</span>
                            <Badge variant="secondary" className="text-xs">{milestone?.type ?? 'Task'}</Badge>
                            <Badge variant={(milestone?.priority ?? '').toLowerCase() === 'high' ? 'default' : 'secondary'} className={(milestone?.priority ?? '').toLowerCase() === 'high' ? 'bg-accent text-accent-foreground text-xs' : 'text-xs'}>
                              {milestone?.priority ?? 'Medium'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{milestone?.description ?? ''}</p>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FiMap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Click "Generate Roadmap" to create a personalized weekly learning plan.</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ============================================
  // RENDER: Mock Interview Screen
  // ============================================
  function renderInterview() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold">Mock Interview</h2>
          <div className="flex gap-2">
            {!interviewActive ? (
              <Button onClick={handleStartInterview} disabled={loadingAgent === 'interview'} className="bg-accent text-accent-foreground hover:bg-accent/80">
                {loadingAgent === 'interview' ? <><FiLoader className="w-4 h-4 mr-2 animate-spin" /> Starting...</> : <><FiPlay className="w-4 h-4 mr-2" /> Start Interview</>}
              </Button>
            ) : (
              <Button onClick={handleEndInterview} disabled={loadingAgent === 'interview'} variant="destructive" className="bg-destructive text-destructive-foreground">
                <FiSquare className="w-4 h-4 mr-2" /> End Session
              </Button>
            )}
          </div>
        </div>

        {error && activeScreen === 'interview' && <ErrorBanner message={error} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="flex flex-col" style={{ height: '600px' }}>
              <CardContent className="flex-1 flex flex-col pt-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 pb-4">
                    {interviewMessages.length === 0 && !interviewActive && !interviewSummary ? (
                      <div className="flex items-center justify-center h-full py-20">
                        <div className="text-center">
                          <FiMessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground text-sm">Click "Start Interview" to begin a mock interview session.</p>
                          <p className="text-muted-foreground text-xs mt-1">The AI will adapt questions based on your performance.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {interviewMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-0'}`}>
                              {msg.role === 'ai' && msg.feedback && (
                                <div className="mb-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-accent-foreground">Feedback on previous answer</span>
                                    <Badge className="bg-accent text-accent-foreground text-xs">{msg.feedback.score}/100</Badge>
                                  </div>
                                  <p className="text-xs text-green-400 mb-1"><strong>Strengths:</strong> {msg.feedback.strengths ?? ''}</p>
                                  <p className="text-xs text-[hsl(36,60%,50%)] mb-1"><strong>Improve:</strong> {msg.feedback.improvements ?? ''}</p>
                                  <Collapsible>
                                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                      <FiChevronDown className="w-3 h-3" /> Show ideal answer
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <p className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/50 rounded">{msg.feedback.ideal_answer ?? ''}</p>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              )}
                              <div className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-accent/20 border border-accent/30' : 'bg-secondary border border-border'}`}>
                                {msg.role === 'ai' && (
                                  <div className="flex items-center gap-2 mb-2">
                                    {msg.question_number && <Badge variant="secondary" className="text-xs">Q{msg.question_number}</Badge>}
                                    {msg.difficulty && <Badge variant="secondary" className="text-xs">{msg.difficulty}</Badge>}
                                  </div>
                                )}
                                <p className="text-sm">{msg.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {loadingAgent === 'interview' && (
                          <div className="flex justify-start">
                            <div className="p-4 rounded-lg bg-secondary border border-border">
                              <div className="flex items-center gap-2">
                                <FiLoader className="w-4 h-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">AI is thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Bar */}
                {interviewActive && (
                  <div className="flex gap-2 pt-3 border-t border-border mt-auto">
                    <Input placeholder="Type your answer..." value={interviewAnswer} onChange={(e) => setInterviewAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitAnswer()} className="bg-secondary border-border flex-1" disabled={loadingAgent === 'interview'} />
                    <Button onClick={handleSubmitAnswer} disabled={!interviewAnswer.trim() || loadingAgent === 'interview'} className="bg-accent text-accent-foreground hover:bg-accent/80">
                      <FiSend className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-base">Session Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Questions Asked</p>
                  <p className="text-2xl font-bold">{interviewStats.questionsAsked || '--'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold">{interviewStats.avgScore > 0 ? interviewStats.avgScore : '--'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Current Difficulty</p>
                  <p className="text-lg font-medium">{interviewStats.currentDifficulty || '--'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Summary Panel */}
            {interviewSummary && (
              <Card className="border-accent/30">
                <CardHeader>
                  <CardTitle className="font-serif text-base">Session Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <CircularScore score={interviewSummary.average_score ?? null} size={80} label="Average Score" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Questions: {interviewSummary.total_questions ?? 0}</p>
                    {interviewSummary.overall_feedback && <p className="text-xs text-muted-foreground">{interviewSummary.overall_feedback}</p>}
                  </div>
                  {Array.isArray(interviewSummary?.strengths_list) && interviewSummary.strengths_list.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-400 mb-1">Strengths:</p>
                      <ul className="space-y-1">
                        {interviewSummary.strengths_list.map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <FiCheck className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(interviewSummary?.improvement_areas) && interviewSummary.improvement_areas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(36,60%,50%)] mb-1">Improvement Areas:</p>
                      <ul className="space-y-1">
                        {interviewSummary.improvement_areas.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <FiAlertCircle className="w-3 h-3 text-[hsl(36,60%,50%)] flex-shrink-0 mt-0.5" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: Progress Dashboard Screen
  // ============================================
  function renderProgress() {
    const data = effectiveProgress
    const plan30 = Array.isArray(data?.plan_30_days) ? data.plan_30_days : []
    const plan60 = Array.isArray(data?.plan_60_days) ? data.plan_60_days : []
    const plan90 = Array.isArray(data?.plan_90_days) ? data.plan_90_days : []
    const skillsProgress = Array.isArray(data?.skills_progress) ? data.skills_progress : []

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold">Progress Dashboard</h2>
          <Button onClick={handleRefreshProgress} disabled={loadingAgent === 'progress'} className="bg-accent text-accent-foreground hover:bg-accent/80">
            {loadingAgent === 'progress' ? <><FiLoader className="w-4 h-4 mr-2 animate-spin" /> Refreshing...</> : <><FiRefreshCw className="w-4 h-4 mr-2" /> Refresh Progress</>}
          </Button>
        </div>

        {error && activeScreen === 'progress' && <ErrorBanner message={error} onRetry={handleRefreshProgress} />}

        {loadingAgent === 'progress' ? (
          <Card><CardContent className="pt-6"><SkeletonBlock /><SkeletonBlock /></CardContent></Card>
        ) : data ? (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <CircularScore score={data.career_readiness_score ?? null} size={90} label="Career Readiness" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CircularScore score={data.resume_score ?? null} size={90} label="Resume Score" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CircularScore score={data.skill_readiness_percentage ?? null} size={90} label="Skill Readiness" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CircularScore score={data.interview_average ?? null} size={90} label="Interview Avg" />
                </CardContent>
              </Card>
            </div>

            {/* Overall Summary */}
            {data.overall_summary && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{renderMarkdown(data.overall_summary)}</div>
                </CardContent>
              </Card>
            )}

            {/* 30/60/90 Day Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">30 Day Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan30.length > 0 ? plan30.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    )) : <p className="text-xs text-muted-foreground">No plan items</p>}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">60 Day Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan60.length > 0 ? plan60.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    )) : <p className="text-xs text-muted-foreground">No plan items</p>}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">90 Day Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan90.length > 0 ? plan90.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    )) : <p className="text-xs text-muted-foreground">No plan items</p>}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Interview Performance */}
            {data.interview_performance && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">Interview Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-xl font-bold">{data.interview_performance.sessions_completed ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Sessions</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-xl font-bold">{data.interview_performance.average_score ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-xl font-bold">{data.interview_performance.best_score ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Best Score</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-xl font-bold">{data.interview_performance.trend ?? '--'}</p>
                      <p className="text-xs text-muted-foreground">Trend</p>
                    </div>
                  </div>
                  {data.interview_performance.summary && (
                    <p className="text-sm text-muted-foreground">{data.interview_performance.summary}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Skills Progress Table */}
            {skillsProgress.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base">Skills Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-semibold text-muted-foreground">Skill</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Before</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Current</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillsProgress.map((sp, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="p-3 font-medium">{sp?.skill_name ?? 'Unknown'}</td>
                            <td className="p-3 text-muted-foreground">{sp?.before_level ?? 'N/A'}</td>
                            <td className="p-3 text-muted-foreground">{sp?.current_level ?? 'N/A'}</td>
                            <td className="p-3">
                              <Badge variant={(sp?.status ?? '').toLowerCase() === 'improving' ? 'default' : 'secondary'} className={(sp?.status ?? '').toLowerCase() === 'improving' ? 'bg-green-900/30 text-green-400 border-green-900/30' : (sp?.status ?? '').toLowerCase() === 'not started' ? 'bg-muted text-muted-foreground' : ''}>
                                {sp?.status ?? 'Unknown'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FiTrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Click "Refresh Progress" to compile your career readiness metrics.</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Mobile Menu Button */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-card border border-border">
          {sidebarOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
        </button>

        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-serif font-bold tracking-wide">MentorMind</h1>
            <p className="text-xs text-muted-foreground mt-1">AI-Powered Placement Coach</p>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = activeScreen === item.key
              return (
                <button key={item.key} onClick={() => { setActiveScreen(item.key); setSidebarOpen(false); setError(null) }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? 'bg-accent/15 text-accent-foreground border border-accent/30' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[hsl(36,60%,50%)]' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && activeAgentId && <FiLoader className="w-3 h-3 animate-spin ml-auto text-[hsl(36,60%,50%)]" />}
                </button>
              )
            })}
          </nav>

          {/* Sample Data Toggle */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
              <Switch id="sample-toggle" checked={showSampleData} onCheckedChange={setShowSampleData} />
            </div>
          </div>

          {/* Profile Summary */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xs font-bold text-accent-foreground">{(effectiveProfile.name || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{effectiveProfile.name || 'Student'}</p>
                <p className="text-xs text-muted-foreground truncate">{effectiveProfile.targetRole || 'Set target role'}</p>
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div className="p-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">AI Agents</p>
            <div className="space-y-1.5">
              {AGENTS.map(agent => (
                <div key={agent.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${activeAgentId === agent.id ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <span className="text-xs text-muted-foreground truncate" title={agent.purpose}>{agent.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 lg:p-8">
            {activeScreen === 'dashboard' && renderDashboard()}
            {activeScreen === 'resume' && renderResumeAnalysis()}
            {activeScreen === 'skills' && renderSkillGaps()}
            {activeScreen === 'roadmap' && renderRoadmap()}
            {activeScreen === 'interview' && renderInterview()}
            {activeScreen === 'progress' && renderProgress()}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
