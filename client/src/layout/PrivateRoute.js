import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from './../modules/users/hooks/useAuth'
import Layout from './Layout'
import { useLocation } from 'react-router-dom'
import Backdrop from './Backdrop'
import { useStoreActions, useStoreState } from 'easy-peasy'

const PrivateRoute = ({ children }) => {
  const isAuth = useAuth()
  const { loading, user } = useStoreState(state => state.auth)
  const { readProfile } = useStoreActions(state => state.auth)

  useEffect(() => {
    readProfile()
  }, [])

  if (loading && !user) return <Backdrop open={loading} />

  return isAuth ? <Layout>{children}</Layout> : <Navigate to='/login' />
}

export default PrivateRoute
