import { NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

/**
 * Telegram 테스트 API
 * GET /api/test-telegram 으로 접속하면 테스트 메시지를 보냅니다
 */
export async function GET() {
  try {
    const testMessage = `
🧪 <b>Telegram 연동 테스트</b>

이 메시지가 보인다면 ✅ 성공입니다!

📅 테스트 시간: ${new Date().toLocaleString('ko-KR')}
🤖 봇이 정상 작동 중입니다!
`.trim()

    const success = await sendTelegramMessage(testMessage)

    if (success) {
      return NextResponse.json(
        { success: true, message: '✅ Telegram 메시지 발송 성공!' },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { success: false, message: '❌ Telegram 메시지 발송 실패' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('테스트 오류:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    )
  }
}
