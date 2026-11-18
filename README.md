# 포탄대결 (Shell Clash)

친구들과 웹 브라우저로 즐기는 턴제 포격 대전 게임. 서버는 Windows PC(Node.js), 클라이언트는 웹.

- 기획·설계서: https://claude.ai/artifact/6Q8s9cAKA13LNwTqZnWiuM
- 화면 목업: `mockup/index.html` (로그인·로비·대기방·게임·결과, 게임 탭에서 연습 전투)
- 탱크 도감: `mockup/tanks.html` (탱크 8종 × 상태 6가지, 탱크별 포탄 3종)
- 아이템 도감: `mockup/items.html` (아이템 8종 아이콘, 칸 상태, 사용 장면)

## 파일 구성

- `mockup/art.js` 공용 그림 코드 (탱크, 포탄, 폭발, 아이템 아이콘, 포탄 물리 수치)
- `mockup/game.js` 화면 목업의 동작 (연습 전투 포함)

`mockup` 폴더의 html 파일을 브라우저로 바로 열면 됩니다.
