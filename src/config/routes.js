import Login from '../modules/users/views/Login'
import Register from '../modules/users/views/Register'
import HomePage from './../pages/HomePage'
import AccountsPage from './../pages/AccountsPage'

const routes = {
  home: {
    path: '/',
    element: AccountsPage,
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
