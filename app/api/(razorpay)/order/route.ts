import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET,
})

export async function POST(req: NextRequest) {
  const { amount, currency } = (await req.json()) as { amount: string, currency: string }

  const options = {
    amount,
    currency,
    receipt: "Order#" + Math.random() * 1000000,
  }

  try {
    const response = await razorpay.orders.create(options)

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: 'Not able to create order. Please try again' })
  }
}
