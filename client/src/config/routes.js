import Login from '../modules/users/views/Login'
import Register from '../modules/users/views/Register'
import Home from './../pages/Home'

const routes = {
  home: {
    path: '/',
    element: Home,
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
