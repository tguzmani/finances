import Login from 'modules/users/views/Login'
import Register from 'modules/users/views/Register'
import HomePage from 'pages/HomePage'
import AccountsPage from 'pages/AccountsPage'
import AccountPage from 'pages/AccountPage'
import JournalPage from 'pages/JournalPage'
import CategoriesPage from 'pages/CategoriesPage'

const routes = {
  home: {
    path: '/',
    element: HomePage,
  },

  journal: {
    path: '/journal',
    element: JournalPage,
  },

  accounts: {
    path: '/accounts',
    element: AccountsPage,
  },

  categories: {
    path: '/categories',
    element: CategoriesPage,
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
