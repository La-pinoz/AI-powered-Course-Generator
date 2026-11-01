import CreateCourseForm from '../components/dashboard/CreateCourseForm.jsx'
import ContinueLearning from '../components/dashboard/ContinueLearning.jsx'

// Page body only. The sidebar, top bar and user sync live in layouts/DashboardLayout.jsx.
export default function Dashboard() {
  return (
    <>
      <CreateCourseForm />
      <ContinueLearning />
    </>
  )
}
