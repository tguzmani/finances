import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const useNavigateAfterAction = (loading, route) => {
  const navigate = useNavigate()

  const [actionDone, setActionDone] = useState(false)

  const markActionAsDone = () => setActionDone(true)

  useEffect(() => {
    if (!loading && actionDone) navigate(route)
  }, [loading, actionDone, navigate, route])

  return markActionAsDone
}

export default useNavigateAfterAction
