import { render } from '@testing-library/react';
import OrderConfirmation from '../pages/OrderConfirmation';

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

test('Order page renders without crash', () => {
    render(<OrderConfirmation />);
});