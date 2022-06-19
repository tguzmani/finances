import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from './../modules/users/hooks/useAuth'
import Layout from './Layout'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { readUserById } from './../modules/users/users.auth.actions'
import Backdrop from './Backdrop'

const PrivateRoute = ({ children }) => {
  const isAuth = useAuth()
  const dispatch = useDispatch()
  const { loading, user } = useSelector(state => state.auth)
  const { pathname } = useLocation()

  useEffect(() => {
    dispatch(readUserById())
  }, [pathname])

  if (loading && !user) return <Backdrop open={loading} />

  return isAuth ? <Layout>{children}</Layout> : <Navigate to='/login' />
}

export default PrivateRoute
