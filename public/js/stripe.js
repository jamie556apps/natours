/* eslint-disable */
var stripe = Stripe('pk_test_tdEPj2I2jLreAyAll5tYlm8J00Io4gcL9t');

import axios from 'axios';
import { showAlert } from './alerts';

export const bookTour = async tourId => {
  try {
    // 1) the session checkout session from API + from the server
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
    //2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    });
  } catch (err) {
    console.log(err);
    showAlert('Error', err);
  }
};
