export interface OrderProduct {
  id: number;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountPercentage: number;
  discountedTotal: number;
  thumbnail: string;
}

export interface Order {
  id: number;
  products: OrderProduct[];
  total: number;
  discountedTotal: number;
  userId: number;
  totalProducts: number;
  totalQuantity: number;
}

export interface OrdersResponse {
  carts: Order[];
  total: number;
  skip: number;
  limit: number;
}
