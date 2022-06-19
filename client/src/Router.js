import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

// Routing
import Login from './modules/users/views/Login'
import Register from './modules/users/views/Register'
import PrivateRoute from './layout/PrivateRoute'
import routes from './config/routes'

const Router = () => {
  const privateRoutes = Object.values(routes).filter(route => !route.public)

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />

        {privateRoutes.map(route => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <PrivateRoute>
                <route.element />
              </PrivateRoute>
            }
          />
        ))}
      </Routes>
    </BrowserRouter>
  )
}

export default Router
