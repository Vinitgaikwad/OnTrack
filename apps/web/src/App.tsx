import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { TodayPage } from './features/today/TodayPage'
import { NotesPage } from './features/notes/NotesPage'
import { AgentsPage } from './features/agents/AgentsPage'
import { DiaryPage } from './features/diary/DiaryPage'
import { DiaryEntryPage } from './features/diary/DiaryEntryPage'
import { TimerPage } from './features/timer/TimerPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { DashboardWindow } from './features/dashboard/DashboardWindow'
import { AuthGuard } from './features/auth/AuthGuard'
import { SignInPage } from './features/auth/SignInPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'

const isWidgetWindow = new URLSearchParams(window.location.search).has('widget')

export function App() {
  return (
    <HashRouter>
      <Routes>
        {isWidgetWindow ? (
          <Route path="*" element={<DashboardWindow />} />
        ) : (
          <>
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="sign-up" element={<SignUpPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route index element={<TodayPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="notes" element={<NotesPage />} />
                <Route path="agents" element={<AgentsPage />} />
                <Route path="diary" element={<DiaryPage />} />
                <Route path="diary/new" element={<DiaryEntryPage />} />
                <Route path="diary/:id" element={<DiaryEntryPage />} />
                <Route path="timer" element={<TimerPage />} />
                <Route path="calendar" element={<CalendarPage />} />
              </Route>
            </Route>
          </>
        )}
      </Routes>
    </HashRouter>
  )
}