import PageWithSidePanel from 'layout/pages/PageWithSidePanel'
import React from 'react'

import Account from '../modules/accounts/views/Account'
import AccountSidePanel from '../modules/accounts/views/AccountSidePanel'

const AccountPage = () => {
  return (
    <PageWithSidePanel SidePanel={AccountSidePanel}>
      <Account />
    </PageWithSidePanel>
  )
}

export default AccountPage
