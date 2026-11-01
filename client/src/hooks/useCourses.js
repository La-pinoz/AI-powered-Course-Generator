import { useContext } from 'react'
import { CoursesContext } from '../context/coursesContext.js'

export default function useCourses() {
  const value = useContext(CoursesContext)
  if (!value) throw new Error('useCourses must be used inside <CoursesProvider>')
  return value
}
