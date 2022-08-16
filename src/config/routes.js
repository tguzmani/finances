import Login from '../modules/users/views/Login'
import Register from '../modules/users/views/Register'
import HomePage from './../pages/HomePage'
import AccountsPage from './../pages/AccountsPage'
import AccountPage from './../pages/AccountPage'

const routes = {
  home: {
    path: '/',
    element: HomePage,
  },

  accounts: {
    path: '/accounts',
    element: AccountsPage,
  },

  accountsById: {
    path: '/accounts/:accountId',
    element: AccountPage,
  },

  login: {
    path: '/login',
    element: Login,
    public: true,
  },

  register: {
    path: '/register',
    element: Register,
    public: true,
  },
}

export default routes
