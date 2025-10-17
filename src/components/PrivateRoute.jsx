import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const PrivateRoute = ({ session, children }) => {
  const location = useLocation();

  if (!session) {
    // If not logged in, redirect to the login page, passing the current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If logged in, render the child component
  return children;
};

export default PrivateRoute;
