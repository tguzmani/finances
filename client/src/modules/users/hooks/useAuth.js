import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { readUserById } from '../users.auth.actions'

const useAuth = () => {
  const dispatch = useDispatch()
  const location = useLocation()

  const { user, isAuthenticated } = useSelector(state => state.auth)

  const isAuth = user && isAuthenticated

  useEffect(() => {
    if (user) dispatch(readUserById())
  }, [dispatch, location])

  return isAuth
}

export default useAuth
