# ViewCamera Assistant v1.0α36

複数ファイル構成へ移行したモバイルUI改善版です。

## 変更点

- iPhoneで2D図と情報カードが重ならないように修正
- 情報カードを横スクロール化
- 3DのXYZ軸を右上へ移動・縮小
- 3Dにピンチズーム追加
- セーフエリア対応
- α31の測定モードを維持
- 今後の開発のために CSS / JS を分割

## 構成

```text
index.html
css/style.css
js/state.js
js/optics.js
js/draw2d.js
js/draw3d.js
js/measure.js
js/app.js
assets/
```

GitHub Desktopでは、このフォルダごと上書きして Commit → Push してください。


## v1.0α36 バグ修正

- 横断面が起動直後に表示されない問題を修正
- 測定開始ボタンが反応しない問題を修正
- 測定開始/停止を1つのトグルボタンとして再実装
- ゼロ補正リセットボタンを確実に表示
- おすすめ運用欄を削除
- 撮影画面の測定ボタンを維持
