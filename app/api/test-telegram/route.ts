import { NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

/**
 * Telegram 테스트 API
 * GET /api/test-telegram 으로 접속하면 테스트 메시지를 보냅니다
 */
export async function GET() {
  try {
    const testMessage = 'Telegram 연동 테스트 - 이 메시지가 보이면 성공입니다!'
    const success = await sendTelegramMessage(testMessage)

    if (success) {
      return NextResponse.json({ success: true, message: 'Telegram 메시지 발송 성공!' }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, message: 'Telegram 메시지 발송 실패' }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '오류 발생' }, { status: 500 })
  }
}
