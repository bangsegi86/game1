# 포탄대결 (Shell Clash)

친구들과 웹 브라우저로 즐기는 턴제 포격 대전 게임. 서버는 Windows PC(Node.js), 클라이언트는 웹.

- 기획·설계서: https://claude.ai/artifact/6Q8s9cAKA13LNwTqZnWiuM
- 화면 목업: `mockup/index.html` (로그인·로비·대기방·게임·결과, 게임 탭에서 연습 전투)
- 탱크 도감: `mockup/tanks.html` (탱크 8종 × 상태 6가지, 포탄 3종을 엔진으로 발사)
- 아이템 도감: `mockup/items.html` (아이템 8종 아이콘, 칸 상태, 사용 장면)
- 맵 도감: `mockup/maps.html` (맵 9종, 눌러서 폭격, 돌발 이벤트, 바람 탄도 비교)

## 파일 구성

- `mockup/art.js` 공용 그림 (탱크, 포탄, 폭발, 아이템 아이콘, 포탄 수치)
- `mockup/engine.js` 월드 엔진 (맵 지형·재질 채색, 땅 파임, 2D 바람, 낙사, 필살기 연출, 돌발 이벤트)
- `mockup/game.js` 화면 목업의 동작

`mockup` 폴더의 html 파일을 브라우저로 바로 열면 됩니다.
