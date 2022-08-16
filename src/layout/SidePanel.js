import React from 'react'

import { useLocation } from 'react-router-dom'

import HomeSidePanel from './HomeSidePanel'
import AccountsSidePanel from '../modules/accounts/views/AccountsSidePanel'

const SidePanel = () => {
  const { pathname } = useLocation()

  if (pathname.match(/accounts/)) return <AccountsSidePanel />
  // if (pathname.match(/accounts\/[0-9]+/)) return <AccountSidePanel />
  if (pathname.match(/\//)) return <HomeSidePanel />
}

export default SidePanel
