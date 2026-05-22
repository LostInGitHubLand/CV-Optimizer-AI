import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import GitHubDocs from './pages/GitHubDocs'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/github-docs" element={<GitHubDocs />} />
    </Routes>
  )
}
