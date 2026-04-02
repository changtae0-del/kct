#!/usr/bin/env python3
"""
새로 추가된 문제들을 모의고사 세트에 연결하는 스크립트
"""
import os
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL", "https://dehlxyxhfbbupzneovyq.supabase.co")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaGx4eXhoZmJidXB6bmVvdnlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU5MTA5MCwiZXhwIjoyMDg4MTY3MDkwfQ.33w8X8M3zofZc6twI_o21E1_yKl8BHl6wkDC4L9RbbA")

supabase: Client = create_client(url, key)

def add_questions_to_mock_exams():
    """모든 모의고사 세트에 문제들을 추가"""
    
    # 모의고사 세트 목록
    print("모의고사 세트 조회 중...")
    mock_exams = supabase.table("mock_exam_sets").select("*").order("year", desc=True).execute()
    
    for exam in mock_exams.data:
        exam_id = exam['id']
        year = exam['year']
        print(f"\n{year}년 모의고사 (ID: {exam_id})에 문제 추가 중...")
        
        # 기존 문제 개수 확인
        existing = supabase.table("mock_exam_questions").select("*").eq("mock_exam_set_id", exam_id).execute()
        print(f"  기존 문제: {len(existing.data)}개")
        
        # 모든 과목의 최신 문제들을 가져오기 (2024년, approved=true)
        questions = supabase.table("questions").select("*").eq("is_approved", True).order("created_at", desc=True).execute()
        
        # 과목별로 최대 15개씩만 추가 (중복 제거)
        added_count = 0
        added_by_subject = {i: 0 for i in range(1, 8)}
        
        for q in questions.data:
            subject_id = q['subject_id']
            
            # 과목당 15개 초과 방지
            if added_by_subject[subject_id] >= 15:
                continue
            
            # 이미 추가된 문제인지 확인
            existing_link = supabase.table("mock_exam_questions").select("*").eq("mock_exam_set_id", exam_id).eq("question_id", q['id']).execute()
            
            if len(existing_link.data) > 0:
                continue
            
            # 모의고사에 문제 추가
            try:
                supabase.table("mock_exam_questions").insert({
                    "mock_exam_set_id": exam_id,
                    "question_id": q['id'],
                    "sort_order": added_by_subject[subject_id]
                }).execute()
                
                added_by_subject[subject_id] += 1
                added_count += 1
            except Exception as e:
                print(f"    에러: {str(e)}")
        
        print(f"  ✓ {added_count}개 문제 추가됨")
        for subject_id, count in added_by_subject.items():
            if count > 0:
                subject_names = {1: '국어', 2: '수학', 3: '영어', 4: '사회', 5: '과학', 6: '도덕', 7: '역사'}
                print(f"    - {subject_names.get(subject_id, f'과목{subject_id}')}: {count}개")
        
        # 총 문제 수 업데이트
        total = supabase.table("mock_exam_questions").select("*", count="exact").eq("mock_exam_set_id", exam_id).execute()
        supabase.table("mock_exam_sets").update({"total_questions": len(total.data)}).eq("id", exam_id).execute()
        print(f"  총 문제: {len(total.data)}개로 업데이트됨")

if __name__ == "__main__":
    add_questions_to_mock_exams()
    print("\n✅ 모든 모의고사 세트에 문제가 추가되었습니다!")
