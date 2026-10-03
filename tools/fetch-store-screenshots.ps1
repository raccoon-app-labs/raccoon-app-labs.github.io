$ErrorActionPreference = 'Stop'

$screens = @{
  'magical-stories/ru' = @(
    'https://static.rustore.ru/imgproxy/hV5vf3wqW5Ib8Xkd3ESf5YrxYQvAdN6FVK_1ZHttTOo/preset:web_scr_lnd_335/plain/https://static.rustore.ru/2026/7/14/bd/apk/2063714510/content/SCREENSHOT/d781c14b-8831-422d-aea5-94c4e9096cb1.png@webp',
    'https://static.rustore.ru/imgproxy/FMZhEBQQPbuFBwUBjFyWW1ySS_hlNOsNCoUeGp96eCw/preset:web_scr_lnd_335/plain/https://static.rustore.ru/2026/7/14/95/apk/2063714510/content/SCREENSHOT/a02f239b-63c1-4b1f-af87-f0ce9a49548c.png@webp',
    'https://static.rustore.ru/imgproxy/rh8b-AHYpHIcwmeT16sHnxsMX5WP7dpvcrye455_baU/preset:web_scr_lnd_335/plain/https://static.rustore.ru/2026/7/14/8d/apk/2063714510/content/SCREENSHOT/22d83366-2451-45ce-8a3f-bed02cd7c6c2.png@webp',
    'https://static.rustore.ru/imgproxy/GD_3lKRZ4L5P1l4HR4aSmmEBoUhbmn9cg8XzLFD0Hzg/preset:web_scr_lnd_335/plain/https://static.rustore.ru/2026/7/14/42/apk/2063714510/content/SCREENSHOT/013b08cf-8de6-451c-ab05-eba2692361c3.png@webp',
    'https://static.rustore.ru/imgproxy/KP4p53IJFFzgJeC4-tH5t0lpbyDXFtqY_pnCbEKtOkk/preset:web_scr_lnd_335/plain/https://static.rustore.ru/2026/7/14/f2/apk/2063714510/content/SCREENSHOT/e2523042-4148-49a6-8e2b-55cf7e041169.png@webp'
  )
  'hanzi-keys/ru' = @(
    'https://static.rustore.ru/imgproxy/nBlw3hDK9bqdoxqjG76NhHT5Z3erb2MYVsLkpoKwvtA/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/15/cb/apk/2063747534/content/SCREENSHOT/2610f7c2-5986-4a0c-8b7b-24c6c57d5b57.png@webp',
    'https://static.rustore.ru/imgproxy/JyQBho-KqgXBwfZDFBu7YFLSMkjZP9QpB_gXdUG12MY/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/15/b3/apk/2063747534/content/SCREENSHOT/f7deb96c-7181-4827-b076-592d64c1c830.png@webp',
    'https://static.rustore.ru/imgproxy/HvRRSz_qOajSfZCrVivE5jxwDuWy9Md44NfHbhsiayg/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/15/zz/apk/2063747534/content/SCREENSHOT/6ae8ca6c-e8dd-4f58-8d89-395511ab9c85.png@webp',
    'https://static.rustore.ru/imgproxy/KKLF_kkaTTQnjlfQk1OQEakdfNomNj6hWj6kCeB4c74/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/15/23/apk/2063747534/content/SCREENSHOT/19171604-835b-434d-98e8-ceb42f4cdec3.png@webp',
    'https://static.rustore.ru/imgproxy/6Vj-L1vekRiuSJ-2q9wWj4_8tIRc0tBNmgkQawTz_Io/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/15/0f/apk/2063747534/content/SCREENSHOT/6208fba5-7b45-4bd4-a89c-c455e20b8911.png@webp'
  )
  'hanzi-bloom/ru' = @(
    'https://static.rustore.ru/imgproxy/swHCgCI4U2kiz7IgxOmV3r3Mj8ibwgq0NPNQH5vu7pg/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/40/apk/2063751702/content/SCREENSHOT/4c75edbd-f45e-46d2-af8f-3deb6d972db5.png@webp',
    'https://static.rustore.ru/imgproxy/8AQ7RdqJTD5ozS9yxXRF_Cbn9NDgKV1L3V19dDYIkn8/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/20/apk/2063751702/content/SCREENSHOT/a92d8d8e-3b68-47d2-a725-53262131f0ef.png@webp',
    'https://static.rustore.ru/imgproxy/VKcOReXa71wg5nXEJfDQ497gzEOTq0BoJImz3cLofr0/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/d4/apk/2063751702/content/SCREENSHOT/876971a7-8885-452f-ae5b-8a20925bae1d.png@webp',
    'https://static.rustore.ru/imgproxy/YvbnTCHyF-hJjU1J9tBeav2jSPFzMtZZT8m3aA4nGhs/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/4d/apk/2063751702/content/SCREENSHOT/b592ee93-1500-4eb8-a677-737777b8e836.png@webp',
    'https://static.rustore.ru/imgproxy/Lty2YaNY_wFi0_6iJDrS53q6bXDP59mXX7lLDO6CfFs/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/d2/apk/2063751702/content/SCREENSHOT/49680e3e-78ca-449f-9d49-42240f545af6.png@webp',
    'https://static.rustore.ru/imgproxy/7npsUfH-LYiCHJuvkRtvGo9vEVP0hN1JPDMj78ltibU/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/2f/apk/2063751702/content/SCREENSHOT/a594e22f-8c20-437f-9bb6-64bb35f6f173.png@webp',
    'https://static.rustore.ru/imgproxy/SbhdMLtTc_EUW5bor7xGyYsWAkMuGEycIUJEP5qHxLM/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/10/d6/apk/2063751702/content/SCREENSHOT/3d435cb7-57cb-4456-beb8-2dd58cc963b0.png@webp'
  )
  'muropolis/ru' = @(
    'https://static.rustore.ru/imgproxy/SriY66OnlTpvReAFbU4dfzBIIFft6_NF_tDGoeuDkbo/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/3e/apk/2063758168/content/SCREENSHOT/7d14e5ea-b79d-4487-992f-201a738b33b9.png@webp',
    'https://static.rustore.ru/imgproxy/txyha2vA3_xsST9tH1KyfH7hREzXJzHBcwewGkqQEic/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/09/apk/2063758168/content/SCREENSHOT/69270e36-a10a-4369-b7e7-9ffd7b88cdee.png@webp',
    'https://static.rustore.ru/imgproxy/CYP5LxcJh1PTpgumpZDm-Y7bgYFSn9LwEnhc8QgCnKA/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/87/apk/2063758168/content/SCREENSHOT/4d10e4a6-f3bf-46e5-bcf4-a2fa3edbbd43.png@webp',
    'https://static.rustore.ru/imgproxy/obpNpjuDDfG05R7ARbAeeFRsGje2W2MZl-G0UEQxyGs/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/d6/apk/2063758168/content/SCREENSHOT/574d2d1b-06cc-4021-9a4a-98e9d6d0504d.png@webp',
    'https://static.rustore.ru/imgproxy/VrXSg8Q5ZF7qXdk-kBLLtl_2F35fFOSD7YPrT8HTKQg/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/5f/apk/2063758168/content/SCREENSHOT/1fabf8ef-2135-4418-bc1e-63e754888d20.png@webp',
    'https://static.rustore.ru/imgproxy/1smUwjzxsZ6-_VH7qo6rOEAV6M9n-2N3_W-t39mdGvg/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/6a/apk/2063758168/content/SCREENSHOT/f18ce913-c30e-4cbd-b488-3ac88554c15c.png@webp'
  )
  'neon-cyber-wall-kicker/ru' = @(
    'https://static.rustore.ru/imgproxy/83hAcizO0rx8eiE61JV_ut6GHJeFdxbnUCcFjOezPIM/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/23/apk/2063749808/content/SCREENSHOT/d76fcdef-2fd7-4de6-89c2-4c4f2d364584.png@webp',
    'https://static.rustore.ru/imgproxy/XDBximgFfAZqIALkH-RLJMUHeiNi0QQphh7FOrCISqQ/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/31/80/apk/2063749808/content/SCREENSHOT/780951fa-35c5-4f3f-8912-e0271596760e.jpg@webp',
    'https://static.rustore.ru/imgproxy/jyqiXgN6Fzfk_UwspNFknXSEf6WOIzH2sQLaLV4xzTU/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/31/1b/apk/2063749808/content/SCREENSHOT/02d85271-5a41-495a-885d-36536cc25ab5.jpg@webp',
    'https://static.rustore.ru/imgproxy/jtWU14VppSmaw1V5w001lgz1gbel8VpoB1YIFPA-fRs/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/7f/apk/2063749808/content/SCREENSHOT/8a4a7e23-3ffc-4d8e-8ba8-45daeb5def06.png@webp',
    'https://static.rustore.ru/imgproxy/UVm4w1hs4wFtC6cAs8GO8QdmpGBmHpaP4vikogC2BXY/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/zz/apk/2063749808/content/SCREENSHOT/aaca46de-71c6-438a-be31-0c527a09ad79.png@webp',
    'https://static.rustore.ru/imgproxy/DbgdvlkK66FqCvADQ5mPWrwTgg-pMJHQXwzRe7orCQY/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/47/apk/2063749808/content/SCREENSHOT/31615232-669c-4597-806e-8d79ceb92d76.png@webp'
  )
  'what-to-eat/ru' = @(
    'https://static.rustore.ru/imgproxy/6LujDqG6F04wTj4qhZm_vS5_U6O1TUDTcf4NRBNwzJw/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/7e/apk/2063749794/content/SCREENSHOT/e080a727-19c4-4244-b6f6-22f2c6c0b554.png@webp',
    'https://static.rustore.ru/imgproxy/tpJ9JdzjCMyXHI3ux4K2EZVI1jNQsEl3JH12ww7FqWs/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/6d/apk/2063749794/content/SCREENSHOT/a41b7738-2983-432f-832f-6b6ba01b8acc.png@webp',
    'https://static.rustore.ru/imgproxy/xExnoWK7AqWcDpBucvXpksZxaWe5Q0bV06o5a7-22Yk/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/f1/apk/2063749794/content/SCREENSHOT/209c5253-c4fe-45c4-ad82-3ebaca21a90c.png@webp',
    'https://static.rustore.ru/imgproxy/1ANn4HgS8hPxxxVVRtg9BAWdLCYTLolvHM9eK96lNYQ/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/f2/apk/2063749794/content/SCREENSHOT/5bba85c2-44c0-4929-8265-b74f45f061bc.png@webp',
    'https://static.rustore.ru/imgproxy/NEe0Yayv8PtO7QIaf14iH23DypqCo6fbWFfyNNMRXrM/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/9/16/73/apk/2063749794/content/SCREENSHOT/260c8e30-31f6-4957-9753-49722ef2ba45.png@webp'
  )
  'dokupit/ru' = @(
    'https://static.rustore.ru/imgproxy/lfgp03RQphDgvMG5O10Abxrv9Hfa1OAZcqku7wa0f50/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/fb/apk/2063749803/content/SCREENSHOT/9da6e329-39ae-487b-a777-0971b5b883f7.png@webp',
    'https://static.rustore.ru/imgproxy/IDO0BgkHUhaf6HzRK3DI4_cxf12HFfa9nr0Uxt9Lx-w/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/9f/apk/2063749803/content/SCREENSHOT/c67c0c81-56de-4f33-b6c8-c6b6e8a13dd9.png@webp',
    'https://static.rustore.ru/imgproxy/KUM70cq3RHV4G58WP05GGE36muQxT5pk57kTi6O3_8E/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/b9/apk/2063749803/content/SCREENSHOT/b84058d5-ef58-4474-87e3-3779426319ba.png@webp',
    'https://static.rustore.ru/imgproxy/AbjtioYwoJete1Fsd9OzpPr_twBNsE4HHArn-eFd4UE/preset:web_scr_prt_162/plain/https://static.rustore.ru/2026/8/25/52/apk/2063749803/content/SCREENSHOT/e56a16ea-e339-4789-955f-9d3530c86c1d.png@webp'
  )
  'hanzi-keys/en' = @(
    'https://play-lh.googleusercontent.com/VbIWmpfxquKvtQ8sJjy5MSenyghhLRZTB1gNhj1McupMaDQVBqNlEK0G2C-OZg1bLKDyg4hTlusn-Y2wrwedSq0=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/Bm00Ewr45Mmw_brYuCiUyV0SS9QK8PS1XjVBedIlhvuQ7D6pkp63bttfx94qX11MTqzQCWj_maBozKZYFogl=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/wqqPtG7HrG8vf0JAjda0cbwFcJoMNfeTm63aOa-xIWZ4Pol7IdPtEeFoOnT3AdheQt2d1k3FwQ61OxQyeGzKmA=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/Dlciivvbmi01va6WDrLpdVD0LoXZ93WZ8fe_NDdtFgSdwo5xKQEykvw5bywc-h-4F8sSEi65_xkCj5YJNWmZ=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/3_X0UY79Y2-uHjhG7VesGqUeVXHgaSH17ZqdNVphdxQzMlhE8Ss6qAVRUf4suruXoZ2vBMX_kYce4EkM21e8=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/C2xY-Wpbra2oOV4uvlIrcY4V8_UkTxwj4IF-svjMjMNrLeZPxoHzxd8xFX_w-hRlCldDbmk9JhRcwEZmvF9Blg=w1052-h592-rw'
  )
  'muropolis/en' = @(
    'https://play-lh.googleusercontent.com/QwhXoYZVLZG4V3vJ4kkKSf08tBreAlQvu2lWPdslfz39jStamdRN658Aa20PYInl0VjAaLRC9FWpe0Q7aLw8=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/xOtC4tBrA4-UaxJhSKZ29Tv5UmzqyPz-jKiqv5Yc2PjFHRQ-WiKgnMWOfDJgbr4a5rdBVQY4AMJTMAcAmwKH=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/Y5ZVE_4nHXTEFWZV5HKzaKxEXQC5fX_jx-2BPSxpC_AEvUqzkFuI1nEjbQVn3WoR5iJJl9lErK67e_VrMnz5Kw=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/9Kes2gnwjb_ZYZVL0mL8JejG6qP9lysD0St0gK9NZRnTC7NWV9RMOLl8fFlOYNixtQUxYeLSNRwV4R3Kf4ivBQ=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/nCvwQlzVm754RRo_OKlPKZmcwEnfOxi5yNZaL0aTPhRgUJV2V_ojFUUD8ZG24aj2EquyPHK8e4Zl3a-2H3XfoA=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/fxG0miWKOqeuARwuV-3aAuvyc-49NLPwysxAN-v9bvtdpXFffkxDM7dNT11-5kSRcwoaH8xrPAz2LpbQpw=w1052-h592-rw'
  )
  'what-to-eat/en' = @(
    'https://play-lh.googleusercontent.com/KQMCPmOs5Fpls-xKQuTAXatnt_JF63ImYilCBWC8R0_1xVBzdbrNA2ZGhnoi_4MhVmOtug8zBZBnWtF6U_7puA=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/mdj7aKNFYYgrQv0J3moKIx1bE0nGVfa-2VbWipSJ5a8B75tu8vXPVH0YO42FbMll03q0mDhfBqPHwN8pG2U1DQ=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/_FYnbb14d7PhmuXeaEWsU5yKDOyFzqTJrTTCW5b45R737dqCA2DfSYG1sKej84TiJDtgHBKB9IpPxosbT3h-OQs=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/YvO8TCNKcQ2nyKnxrCP7gr9aIIuYkSK19fVzCSY2pDrUxBQmcGsvwJm8v-vE9eOqACLRHiWOw6IUQ5DwMX-lKlY=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/VK7GtOLX-ns750SHbOHWLJG5_5WtjwgOMbA3edE5e1cQzyoMIsl-HpBo5xxkPk9oeJy3Eecile1ra3WLmNC4UA=w1052-h592-rw'
  )
  'dokupit/en' = @(
    'https://play-lh.googleusercontent.com/Ldiy2syLDmgx4IyFzkj_-bChrR8oR-BwuhUyVybYDF48TLFXIlFamEibdyIxIaDm6Wfo6EVGrUjTp9mRTKLv6iY=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/HCoY96WybxfMI3d3y5-NZYp3lZIhRRMHrWOJaCkgRo9uwlFBcAipwZV8CvRarqRi7mZKniVLY6IFhe82SGKb=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/M6MZb1KAMz0iWhH4g2EyhP6DTvDQwi7WqFVJ8VcACNmPRuDN8f36l7yL9oZ7jb7ugnOo09RX6uu6V4J7ukAMD54=w1052-h592-rw',
    'https://play-lh.googleusercontent.com/dlRjzLkmsQnSBPs1sj0TlFC0bn5VbYebl1_7fQ_XQ7OXHgRAW0AdhCc78pFjKKWIE19Lc9TmWTXQ_X3wJ8HYMQ=w1052-h592-rw'
  )
}

$root = Join-Path $PSScriptRoot '..\assets\screens'
foreach ($entry in $screens.GetEnumerator()) {
  $target = Join-Path $root $entry.Key
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  for ($i = 0; $i -lt $entry.Value.Count; $i++) {
    $file = Join-Path $target ('{0:d2}.webp' -f ($i + 1))
    Invoke-WebRequest -UseBasicParsing -Uri $entry.Value[$i] -OutFile $file
    if ((Get-Item $file).Length -lt 1024) { throw "Downloaded file is too small: $file" }
  }
}

Write-Output "Downloaded $($screens.Count) screenshot sets."
