import fs from "fs/promises";
import path from "path";

import prisma from "@calcom/prisma";

// Your input data
const users = [
  {
    email: "manas@onehash.ai",
    secret_data:
      '{"value":"8ftqHvIT6Rvn00t6OXgI+9QjufbrEJT3bNGoeMXMGC0=","salt":"95TlRD9NuUQdYaTzMnSuGg==","additionalParameters":{}}',
  },
  {
    email: "lelmozalte@gufum.com",
    secret_data:
      '{"value":"jgQ7Brwl9XzbMv5COBT8wOiMbQXm6C+PpxJ9HO3ZsUA=","salt":"o8yo/7tl1sUsUwEoa/50ag==","additionalParameters":{}}',
  },
  {
    email: "giknetukko@gufum.com",
    secret_data:
      '{"value":"VwPAoWqhPRiqlMVNL9CuB58WGf2R+vcLFsyYcIm3Hnk=","salt":"Npjgkfbtto/v8rrsrbmEEg==","additionalParameters":{}}',
  },
  {
    email: "locowi6560@dxice.com",
    secret_data:
      '{"value":"aVMbLC/RPey1JdtS/uWTIznE689CQFVuN/U0AebITk8=","salt":"BOqHICL2vup6uXmS62k59A==","additionalParameters":{}}',
  },
  {
    email: "shivam7nsingh@gmail.com",
    secret_data:
      '{"value":"goqlrqm8bOVS6WyKsD220YRb/F4y+7KgMNB5i9V1MUY=","salt":"7DZZ0Uu8q0Z7P77SUyzD4A==","additionalParameters":{}}',
  },
  {
    email: "rishabh+1@onehash.ai",
    secret_data:
      '{"value":"uw9VRL10QjCbLpza0lv03oHQ6jYuTJ8d7cyV6hXz7wg=","salt":"C8bHvn77TTqRGmgpLX6XnA==","additionalParameters":{}}',
  },
  {
    email: "reltanupsu@gufum.com",
    secret_data:
      '{"value":"PzA6t7io9CmTf4YRjtiq5j+MRDTlK3VJO5lCc/kO0HY=","salt":"X0IUPEqiVYxP3JlTyby6yg==","additionalParameters":{}}',
  },
  {
    email: "rishabh+2@onehash.ai",
    secret_data:
      '{"value":"f4YGZNjge53bo6qg9nsnhri09WIXSoGRzQkgYmxvl2w=","salt":"f/WGu4sPz7Zi638mkmbmCQ==","additionalParameters":{}}',
  },
  {
    email: "xogexa6850@forcrack.com",
    secret_data:
      '{"value":"w9iIdmdQvajsD6TeWp+TS/kcNMfqAOSnnCVAB+rbhxs=","salt":"hT4etXIGlF+yfzZXGPoufw==","additionalParameters":{}}',
  },
  {
    email: "rishabh+5@onehash.ai",
    secret_data:
      '{"value":"e34+VS/nvG0RiFNgokU18eXbAXpDS0okDTpL1S4gmUM=","salt":"YkjsEXLKJg415Sr+ucndIQ==","additionalParameters":{}}',
  },
  {
    email: "rishabh+7@onehash.ai",
    secret_data:
      '{"value":"kGJBguMZUYYj21MZ3imkwvT0xnX3gdmWC4gmWzdksJA=","salt":"xAlJS/jB/+kWkfzpqCMgAA==","additionalParameters":{}}',
  },
  {
    email: "cekniyespe@gufum.com",
    secret_data:
      '{"value":"gWUHTw0zKU+tU2lf+J1Sr2hF6jWqEo5q2T01suYPKdg=","salt":"ouoAmKYHBxQ5DHIfakPnWQ==","additionalParameters":{}}',
  },
  {
    email: "rishabh+11@onehash.ai",
    secret_data:
      '{"value":"9mxf8ZoMXlga9DsGsDEcFRC92qGdmL0gzTgOzPFD0Rg=","salt":"uYmDw5y3OXDmVoBQAjQAMA==","additionalParameters":{}}',
  },
  {
    email: "rishabh+6@onehash.ai",
    secret_data:
      '{"value":"lVZGhRh/eDS9IaSHzgSMNQXROea/5hdIkTpAixdB0IU=","salt":"rLIM+t7sUk/eLq0nakJqyg==","additionalParameters":{}}',
  },
  {
    email: "garfield261000@gmail.com",
    secret_data:
      '{"value":"J2lrjbRgB5DlgBVNFkMwjw7uiierzbzQ9K84Wvhwamw=","salt":"BGjpbClwCKN8raeb8EBJCw==","additionalParameters":{}}',
  },
  {
    email: "rishabh+00@gmail.com",
    secret_data:
      '{"value":"KZZ70RrAU6WqV+ar5ITl+NpIc/mS7fqflCIs1eTs6pQ=","salt":"dmAK2zE7+uxp3RlkQ363oA==","additionalParameters":{}}',
  },
  {
    email: "rishabh+00@onehash.ai",
    secret_data:
      '{"value":"XfemXR/6R6ib/m3PE7uFuFa/82BlCwV4c/VmmgoFhEI=","salt":"vx32QlC+nxGWV1T8WMheiw==","additionalParameters":{}}',
  },
  {
    email: "rishabh+001@onehash.ai",
    secret_data:
      '{"value":"p2c5jFjks7xrJUYU0hnkDWpfcAG9FPv+azqvwgNYIxc=","salt":"NxrTeKPhQtkBVQMA+z0l/w==","additionalParameters":{}}',
  },
  {
    email: "ribana4970@nab4.com",
    secret_data:
      '{"value":"Abs7mcVETBqBKMKQlaTnpS5L0ADmB7U2mxH4Xe1lwAk=","salt":"m4e794pZNewKrCTycND+4w==","additionalParameters":{}}',
  },
  {
    email: "jefir77111@ofacer.com",
    secret_data:
      '{"value":"fZT3ewWuLRZ/XR0loQcwzbs1pFM++mTWW5BkFp84UU8=","salt":"oRYFYLf/8DlN+lSgJbOX0g==","additionalParameters":{}}',
  },
  {
    email: "fovino3448@exitbit.com",
    secret_data:
      '{"value":"V1hmSsrkHJkbSvl0kULf4SeaMh8DAD7v7M6THZz2JqA=","salt":"Lq6RXoLkGVy/KuiDsyHdKQ==","additionalParameters":{}}',
  },
  {
    email: "kexop31014@kimdyn.com",
    secret_data:
      '{"value":"F1+Z5J2dNhS9o4A4cH/VDsz84oz+122ECrsIy0ZAWxs=","salt":"ypZyFSXqxzne4x7lCDxM3w==","additionalParameters":{}}',
  },
  {
    email: "yesivam482@decodewp.com",
    secret_data:
      '{"value":"cKJ4lz/jNAQk/kfSM62u+KvbmqdBN126x/AbRKU3j1o=","salt":"XqRtBoswufZg0PJoJI8WhA==","additionalParameters":{}}',
  },
  {
    email: "tawode8634@kimdyn.com",
    secret_data:
      '{"value":"VM9nso7rGmHHDQvCb7ExsEUmG6V/pW0sPaRMUG1UVpo=","salt":"sEMDdk7wQoUbLncgz8uclg==","additionalParameters":{}}',
  },
  {
    email: "dihosa6349@ofacer.com",
    secret_data:
      '{"value":"tRfZmiUwD/zszX3QY7zHlUkfNQ014o5zAcbyRET15b8=","salt":"d1Do65Va/XHuXes3yH3A6g==","additionalParameters":{}}',
  },
  {
    email: "nabarad987@ofacer.com",
    secret_data:
      '{"value":"iDy63zlpmD0U13f6U/1pC3EFIyY5Z5cAvS58a6VCl9I=","salt":"9ZDOEw0TGPe5cmRh9oORRQ==","additionalParameters":{}}',
  },
  {
    email: "kixaj50273@asimarif.com",
    secret_data:
      '{"value":"nyeYZPto5nBrVZK9XpHjwUvTXvzSCUcNEcld/SYQkds=","salt":"Xd2JZZEob34fAibBOjgfhA==","additionalParameters":{}}',
  },
  {
    email: "yolom34714@decodewp.com",
    secret_data:
      '{"value":"wwJFtd6w7wPIbkkdaLyYs9Lh/aiC8WkaJNh4ztKhHIs=","salt":"a9Q+5NlX4+kfu0bt9fUBUg==","additionalParameters":{}}',
  },
  {
    email: "kilecid544@boxmach.com",
    secret_data:
      '{"value":"jnyky974R1DdVSToBEmhgnkb562O0cBNTIHtQzY7yW0=","salt":"aBrmimWIt+kM/hKQ9QB7Qg==","additionalParameters":{}}',
  },
  {
    email: "yalano3958@coasah.com",
    secret_data:
      '{"value":"m+PznG/EOmiOy1bhxl4JzJlA0bsf6b0xQjwvRjkGtPw=","salt":"VESDCQqRGMNZUW5rVCakfg==","additionalParameters":{}}',
  },
  {
    email: "mixibis853@decodewp.com",
    secret_data:
      '{"value":"SKTB3YZZUB+Z+xip7KL77jon30cYvaob6zLQz22py+Y=","salt":"WN4rYQtho8RdXQ9MngKwSg==","additionalParameters":{}}',
  },
  {
    email: "sokon47736@decodewp.com",
    secret_data:
      '{"value":"7VoHfRDsDO7JA2ntdcPKRwlBeJsRdFmw3rHI1mKC880=","salt":"UQVtiWkrv1NxszMYR5C4zQ==","additionalParameters":{}}',
  },
  {
    email: "gopax37569@ofacer.com",
    secret_data:
      '{"value":"hz7pBH84XcUx41G4rl+8pC1QnBjCnfgWhlLiKtrp3ao=","salt":"0MijF7UDMg7y2KxumLYovQ==","additionalParameters":{}}',
  },
  {
    email: "xabopef727@kimdyn.com",
    secret_data:
      '{"value":"/gM1/o9ab6hFFTeXPzVTWy28VOsJRjGEG1/uyEim7CE=","salt":"xZRSmnVy1xA8CsFasO3Lrg==","additionalParameters":{}}',
  },
  {
    email: "wofaji7638@ofacer.com",
    secret_data:
      '{"value":"A9hMl6hpvOf8kv96lt55H+e/vSIQzqmLL7LpFd2XBX0=","salt":"8c4QO3I3zmbh/PnZgKk0ZQ==","additionalParameters":{}}',
  },
  {
    email: "ponefof197@kimdyn.com",
    secret_data:
      '{"value":"d4EbFxKtQhIAvmmSuVesUBZn7hceJpTvwc1S4Zx0blU=","salt":"tKYRtmJ/5mgJv+lfMq5uOQ==","additionalParameters":{}}',
  },
  {
    email: "silim35499@ofacer.com",
    secret_data:
      '{"value":"h+noASvo0nxm5XOs0NIqR1mM1MERKQXINAkED6ghzS4=","salt":"DpsnnnebzpTVuIOmOfVqNA==","additionalParameters":{}}',
  },
  {
    email: "kenipe5764@ofacer.com",
    secret_data:
      '{"value":"9EVuQ9+uYuGMtTILKf4DGaYlV+SM4MGH2Zt1712FaIo=","salt":"cmaX5Mt7++iFCZRLn8Z3zQ==","additionalParameters":{}}',
  },
  {
    email: "xifayi1399@kimdyn.com",
    secret_data:
      '{"value":"iDTLnNEGLlUGlpgD8fE4F011Ym93QE0Xr4FQ7ESOsRY=","salt":"F/L9bIuIsWKoYBL4hPA4bA==","additionalParameters":{}}',
  },
  {
    email: "garam17868@kimdyn.com",
    secret_data:
      '{"value":"n0BRICt7F2d5VQvGXMvPBJCVuE5+O6ymmsxuIfckXSI=","salt":"ai3edTtL92krwbLrCzpjgA==","additionalParameters":{}}',
  },
  {
    email: "piyakip153@exitbit.com",
    secret_data:
      '{"value":"ftaJ4Z92LVJnfR3rpcPoND93UhcjYEUeqxXpQ46mu0k=","salt":"u7ZOGb7oP0fsRRkroF0JMA==","additionalParameters":{}}',
  },
  {
    email: "rishabh+190424@onehash.ai",
    secret_data:
      '{"value":"ZP0ry71PQnNtEG3SBsQ/ZTzVPbRv+bi36SDwpc4iNIM=","salt":"7v/IFsCK37JTt+v68UKaXw==","additionalParameters":{}}',
  },
  {
    email: "rishabh+230724@onehash.ai",
    secret_data:
      '{"value":"myij+b1900MrK0KYdR541C6Fz7sgL/ToUbG4loWi+tE=","salt":"IqTGBGRew21Ea5GA+yK7DQ==","additionalParameters":{}}',
  },
  {
    email: "rishabh+75@onehash.ai",
    secret_data:
      '{"value":"zaLX3PR6+qRoe6pEyA+lUYtGVkWvM9/fuWrHdnYBGdM=","salt":"z3PfCVER+PP4e7QzjpdKoQ==","additionalParameters":{}}',
  },
  {
    email: "burtedarze@gufum.com",
    secret_data:
      '{"value":"YALNu5cha8danuZTa5TvOb1aqm2XAGJJmyVW8wkdZEE=","salt":"kclIaPZvjdEhSvKoI/gl6A==","additionalParameters":{}}',
  },
  {
    email: "beachamp007@gmail.com",
    secret_data:
      '{"value":"5A7pYkSDIuX1gDsyumilZy1oWAb5phuxmLVWe09Jl7c=","salt":"mCUpEudxemBczdj+cFJPhA==","additionalParameters":{}}',
  },
  {
    email: "saydepodra@gufum.com",
    secret_data:
      '{"value":"BqFCo2+Wr5zOA3WC44MjQwMqZ+XGYkV00Slw3hd3zd0=","salt":"VaNu/k+kBSn1eTqpwVDeiQ==","additionalParameters":{}}',
  },
  {
    email: "engineering@onehash.ai",
    secret_data:
      '{"value":"84fvCA9evWyR13WioRhPccNn30hQCNGdbPh4ZzPHZtY=","salt":"xaS0tflWViN5QYE+xfMxHA==","additionalParameters":{}}',
  },
  {
    email: "test@onehash.ai",
    secret_data:
      '{"value":"cyC+GyM/PBFWpOyA5yj1+o8Av2so8lIlSlvFoIV/LEU=","salt":"jEOlqSY2uZuXJcINzhIyzw==","additionalParameters":{}}',
  },
  {
    email: "rishabh@onehash.ai",
    secret_data:
      '{"value":"0vBM2PQpt4MLrA3AAAjVBe7a/0PP6TJpjvpfnnbdlJ4=","salt":"pY5mw4+eV1MOKXQKSIlDpg==","additionalParameters":{}}',
  },
  {
    email: "test1@onehash.ai",
    secret_data:
      '{"value":"lvY2fHmPGDOfPs3B23o36/aBsagPqT1hCaDpXyGeZQE=","salt":"Av5cz0/1rezXMzzyZxovAg==","additionalParameters":{}}',
  },
  {
    email: "arjun@onehash.ai",
    secret_data:
      '{"value":"mpN0+IO+7B3Ko7F1HcyshsD+6Bfsu/TL3jF9Owe8F/0=","salt":"PWoloP7GVXLy7OiHHC8vZA==","additionalParameters":{}}',
  },
  {
    email: "tetrubaspa@gufum.com",
    secret_data:
      '{"value":"un7V5J3drYXpuJ870a0PQQl18QnENDGph7DuNNsNRA0=","salt":"u2iQ4EgvbptM9PMjdDozzg==","additionalParameters":{}}',
  },
  {
    email: "fakic30109@cetnob.com",
    secret_data:
      '{"value":"j7PwDjfZVys6gsehoITid39gBjF5kc2tBPjD0wKS4nc=","salt":"7p80PTucKnpXzqsvo3a68Q==","additionalParameters":{}}',
  },
  {
    email: "daxit58648@skrak.com",
    secret_data:
      '{"value":"0QMrBDrLYTLdrnqxRlkXdYkWfGAN8EUiCuq4lkt74Z8=","salt":"Pbp/gHXmGMUl6VNOoLmg6Q==","additionalParameters":{}}',
  },
  {
    email: "xijepa4161@chainds.com",
    secret_data:
      '{"value":"mt5mINOPa9B3tw6GO2YyXayO7MnyncGpGWeuH8LsHGI=","salt":"3Vi7tfwX+fWrJlxnOyyEkg==","additionalParameters":{}}',
  },
  {
    email: "yadovig877@hraifi.com",
    secret_data:
      '{"value":"b7npqS6RqjJbhSQL1+oS11r0RxLodOieOvH+s4vUmmw=","salt":"qUU7NzQnXDPpzVhKJRPoSw==","additionalParameters":{}}',
  },
  {
    email: "kjoi@dwa.ai",
    secret_data:
      '{"value":"ilXRDngK3onHEHKwweI7hZ3yd2gRcIwiYZLXohnTZAQ=","salt":"vv0vKiwE4uTbhqlcTUXh1Q==","additionalParameters":{}}',
  },
  {
    email: "cocerik929@hraifi.com",
    secret_data:
      '{"value":"5CSl2SZguXqpMOUXN4CG+ArTcjT/0m/enRnZ+NddDz0=","salt":"WKDd4ERa4Bshpu2jMUKMQQ==","additionalParameters":{}}',
  },
  {
    email: "gofigab630@digopm.com",
    secret_data:
      '{"value":"eLVsp8aj7o8v/rNT3plIh1UTw7hlDE0UEhyhj8bhbCo=","salt":"t0laQYKgLXHiTvOKzA3fMg==","additionalParameters":{}}',
  },
  {
    email: "hofam50803@regishub.com",
    secret_data:
      '{"value":"dfmrTYUsKr/+QEfEozQ3g3REtWB5DX5jDGB39///yto=","salt":"kk6KDEKmQR1tSXsDXumVJA==","additionalParameters":{}}',
  },
  {
    email: "rishabh+04111301@onehash.ai",
    secret_data:
      '{"value":"KJcohvOG8Jw41+z2IPYGaukVfFefuiWgW4es9W+lY4A=","salt":"BOnAFIX3GjoTs2Siy3zFXg==","additionalParameters":{}}',
  },
  {
    email: "rishabh+04111329@onehash.ai",
    secret_data:
      '{"value":"Iab2Sul+zPkehxpMS2oq3bZSZXp7vJoDDeiWaU8obFg=","salt":"lQVvHPC0IG1XVq4tmfv7xQ==","additionalParameters":{}}',
  },
  {
    email: "risesi5544@nozamas.com",
    secret_data:
      '{"value":"FYPiIqGsFE26cxehUdpqc1KSsVByPalYHMCxNMjemDM=","salt":"NviscwZw6dxbZrC0zGdcYg==","additionalParameters":{}}',
  },
  {
    email: "jilabel757@merotx.com",
    secret_data:
      '{"value":"kRObXNPi60nuqEM97dkBQq6CyJkZKoxI1YstpkI61sM=","salt":"an682tbZFpjXnOkroKi/HQ==","additionalParameters":{}}',
  },
  {
    email: "girivad259@kazvi.com",
    secret_data:
      '{"value":"QRIDUiDAkn2NdLSQ9ld+7AkOuBHmSgRBTXp6dTBiqlA=","salt":"Ycoy4ptkL3CNoYWdCgHdxw==","additionalParameters":{}}',
  },
  {
    email: "wecav14526@merotx.com",
    secret_data:
      '{"value":"+CknEJDJ8Ff8cwF/sFI/tMJNfjTtxnP8Byf9JMSSoYo=","salt":"RQVi+VhLjOg59cdpKmAxnQ==","additionalParameters":{}}',
  },
  {
    email: "rohit.yelmar@onehash.ai",
    secret_data:
      '{"value":"I3rRrbFmxXokb6/g/gX4bxi7tK5ga5YusiTKkwxsfws=","salt":"Vu9fCrdEOZTMgeUrqrkO1w==","additionalParameters":{}}',
  },
  {
    email: "diknecespo@gufum.com",
    secret_data:
      '{"value":"+wtNnMTsGkuZUnXdwoydzDXbyv85KbHd0DPvI12I0ns=","salt":"xfmPT07YgtOo9FUgZ6yfNQ==","additionalParameters":{}}',
  },
  {
    email: "fignemudro@gufum.com",
    secret_data:
      '{"value":"9n4Z45iulRFHFAZoO8tDTtMAXUeghCrGatj0wmX2Q0Y=","salt":"yNa6jrLKO7B+ZiLF3lTNFQ==","additionalParameters":{}}',
  },
  {
    email: "gerzadortu@gufum.com",
    secret_data:
      '{"value":"tldClc2V5DKtTAKY+HnCnrA9JIQFhs/euhXuxRbg0ic=","salt":"swGb/hIXSuxF+MysLd/56Q==","additionalParameters":{}}',
  },
  {
    email: "fartetispe@gufum.com",
    secret_data:
      '{"value":"2Dt7I4G5bWoSBch6tfKKUS0u/yYNyiuvvDPByfzh3QY=","salt":"EiW74k0lROdBU156Bb7KAQ==","additionalParameters":{}}',
  },
  {
    email: "pirduterku@gufum.com",
    secret_data:
      '{"value":"f0A0T5bQRIBhpMezuc57aJydXetKOzGRICQM8kG8lZY=","salt":"QR0cggRXpEgplSnKoSHe7Q==","additionalParameters":{}}',
  },
  {
    email: "rertozutre@gufum.com",
    secret_data:
      '{"value":"o1twgZb4LKTsC4qngc5qOSra9WN7/VTazijBVUzOAvs=","salt":"A6N5FrxLiOip2hBtPK9Csg==","additionalParameters":{}}',
  },
  {
    email: "gipsodupso@gufum.com",
    secret_data:
      '{"value":"w0mFWIkqkA8hcE00cRm6wbvq5AdRLwAtXe3sSHLoHII=","salt":"300FsUjZqJzopJtJa+x+TA==","additionalParameters":{}}',
  },
  {
    email: "yoydutigni@gufum.com",
    secret_data:
      '{"value":"OeYgaJ2/+bFE97NNf0IHtfr6i9eB5npbHFRqS44V5fg=","salt":"LPHqdbul9LHdbBJq776kZA==","additionalParameters":{}}',
  },
  {
    email: "cospiligni@gufum.com",
    secret_data:
      '{"value":"rsINgTgSsKEkjoPSE62mWdPreaPrg84b/HoplDYB/q8=","salt":"+gcjaz0ooAGy0KxM+RBnaw==","additionalParameters":{}}',
  },
  {
    email: "rishabh+130120251251@onehash.ai",
    secret_data:
      '{"value":"Cel4uoJtVt3VFsztaoRvvqXDl+1mM9oviR3grxz9ua0=","salt":"rYKiV1RW0AaZvDXQ+KLvkw==","additionalParameters":{}}',
  },
  {
    email: "manas.laud@onehash.ai",
    secret_data:
      '{"value":"C2QL38SCRM0lkzvWfMykVQmLxfvQ7j3N7lwphUDSUbs=","salt":"ONOG9k7m5WsC2R70OvMuRQ==","additionalParameters":{}}',
  },
  {
    email: "wayig13922@payposs.com",
    secret_data:
      '{"value":"9zFp/3kmldv03Uj3qeC0r6WS7FLgyy7xAHQkF2Uqkx8=","salt":"T3VfQdbrluhkJWXHo/Knkg==","additionalParameters":{}}',
  },
  {
    email: "cesetid562@hikuhu.com",
    secret_data:
      '{"value":"fdUoPg1q4s5AMsXdWNxyJDAK+MkAiiBjDYeT5B95idg=","salt":"FCdE/SIFysDi6eTZapZKgQ==","additionalParameters":{}}',
  },
  {
    email: "sukhmander111101@gmail.com",
    secret_data:
      '{"value":"wK+8HRBjc/qhr7/w6unUxx3SzIkUyXA0dBQiiVMOV4M=","salt":"6JGZCBjxJ3UK72HK29jvRA==","additionalParameters":{}}',
  },
  {
    email: "rohit.a.yelmar150904@gmail.com",
    secret_data:
      '{"value":"/73MFdX1PBLTArr9M6eyFJjp5KuoInpJVJGvvGC6zUE=","salt":"CDVatWlUYVb/blup4YOG5A==","additionalParameters":{}}',
  },
  {
    email: "baraloh415@oronny.com",
    secret_data:
      '{"value":"PdrkXbHEnzmKBlR168kkSkey+ad1cLWh48Wmb48utiY=","salt":"YrrFk8wij75Fx1VQVcZqEA==","additionalParameters":{}}',
  },
  {
    email: "vasehyha@logsmarter.net",
    secret_data:
      '{"value":"cdBxTgtRW10LtMT4c7IVW082WbAsJdWkFdw95jJy2nU=","salt":"1zeDcykTDCeuWodG324C2g==","additionalParameters":{}}',
  },
  {
    email: "tihajik582@oronny.com",
    secret_data:
      '{"value":"sssMUH3jOuRsAcKcsJN4BufobLgfzojqqTZ/k3/SIJM=","salt":"2qLujL3hbnsFaQ2HEn2s7A==","additionalParameters":{}}',
  },
  {
    email: "dasolom902@oronny.com",
    secret_data:
      '{"value":"2LFGYesZauLYdC9ImScaMPMrbKcvzqeM3pd8XzkeqcU=","salt":"X0UEeOBUWcFntYrhDp2MSA==","additionalParameters":{}}',
  },
  {
    email: "95xrohit@gmail.com",
    secret_data:
      '{"value":"nMDBmyN9FkleV/zUYd6q8IAKisJ/VBgNNHb/hXsiRRA=","salt":"w3+t2p9L4PTcbCyXoPtzxA==","additionalParameters":{}}',
  },
  {
    email: "sukhmander@onehash.ai",
    secret_data:
      '{"value":"KZzZF8fqu5CgtR4JecW2aMjMORmJMLvGlKIeVkA7Wko=","salt":"OoSjOpxsoTdkPliwII/O7w==","additionalParameters":{}}',
  },
  {
    email: "golu@onehash.in",
    secret_data:
      '{"value":"oqb4pVQYvp1I7vEN8MhkLOO/LfLQ0fIjQJBICFARgSE=","salt":"5zRSVhwpmWx4utce5VWAGA==","additionalParameters":{}}',
  },
  {
    email: "golu@onehash.ai",
    secret_data:
      '{"value":"wQ7AlwdibIetwyG0nW6uwD8bSxMkWG9KejoagWFXL1U=","salt":"Q2d4COObdmgnjhilW8JVGw==","additionalParameters":{}}',
  },
  {
    email: "avnotaklu111101@gmail.com",
    secret_data:
      '{"value":"bkm2v8YAXMkXVWgrL52awJ+tfCCWFIVN0qHNiae+Wvo=","salt":"GmMJ68qCjnxhEyurfqCNqA==","additionalParameters":{}}',
  },
  {
    email: "aryan@onehash.ai",
    secret_data:
      '{"value":"+n5lwYvAWmISspTLnl/lwtoXY9dBgQ3OZ2Jj/1IEWrU=","salt":"WN5WB4XsIcTBovC+V4e7qA==","additionalParameters":{}}',
  },
  {
    email: "sosewes628@frisbook.com",
    secret_data:
      '{"value":"IBge6DB2UwC1SjQTJX3TiOLRhT7WqI35Gs6Dg8scZBc=","salt":"oXmJn9GBAI0VbqR10Bacbw==","additionalParameters":{}}',
  },
  {
    email: "onehash111101@gmail.com",
    secret_data:
      '{"value":"NUUAsbTzmEhQKZBvZZ3LWktewbozTgkgmYDS7rxn43E=","salt":"B43tYKNDUdUQNtplxtTgMg==","additionalParameters":{}}',
  },
  {
    email: "integrations@pabbly.com",
    secret_data:
      '{"value":"oY+w2ziUClK+thGZp9kUu6OpFsokqIrmBkzl4LHIBIQ=","salt":"PUqMcyctSwyxI0N61l3o5w==","additionalParameters":{}}',
  },
  {
    email: "doxak43451@ofacer.com",
    secret_data:
      '{"value":"reW6ock70yveYjACoBsfij1m+p6+hEKv9VVHvz5ObUQ=","salt":"0zi7rE03qG/D/iwmn6ognA==","additionalParameters":{}}',
  },
  {
    email: "todoyad332@kimdyn.com",
    secret_data:
      '{"value":"WTdMuZLtof9P9ZaZKEzKZJPHKWgEWaxd7Gc4mGXYomA=","salt":"TP/RGeG3PcqqCkgIOo7LFA==","additionalParameters":{}}',
  },
  {
    email: "vayawop223@kimdyn.com",
    secret_data:
      '{"value":"197RyyM+lErdCoIICN9tzwTXYpiWLwiRY9glSS0PAio=","salt":"DJYfKrGN5ZNkwFF5rUQeCg==","additionalParameters":{}}',
  },
  {
    email: "deyom44663@ofacer.com",
    secret_data:
      '{"value":"AmDhnON9XDxeoK33jcqkUg5KV0nYU3+I7fpY9TsIckA=","salt":"oZN90TlhPRQRBjfwJz7Uhw==","additionalParameters":{}}',
  },
  {
    email: "jaxeci5182@kimdyn.com",
    secret_data:
      '{"value":"FTDort6ifHsvq4eap1srE+dJZqDZzesTgNL2uIunG40=","salt":"F7tEcw+RW7Tih4gD6FkJvQ==","additionalParameters":{}}',
  },
  {
    email: "siwoj38134@kimdyn.com",
    secret_data:
      '{"value":"VvYFUSCUvgLqFmKkbJMBqAfquOREdOA7qEegUBfTkiI=","salt":"myQQOFYfgoPM9tcZoynJmA==","additionalParameters":{}}',
  },
  {
    email: "famaxel398@kimdyn.com",
    secret_data:
      '{"value":"16hmAH9iOjDmsTmUXiYwNZEqOYpTJu5SlTvn2me1D3Q=","salt":"F0v4aqD3VTy5FAiJaJQ8OQ==","additionalParameters":{}}',
  },
  {
    email: "jixonim858@ofacer.com",
    secret_data:
      '{"value":"0wTQQvxAZe0NVLQCcEAB/UtIPPe0OnaqCIpuOWwU/QE=","salt":"Xczd6zrZT9jHWOOTGjrMHA==","additionalParameters":{}}',
  },
  {
    email: "gatixib690@kimdyn.com",
    secret_data:
      '{"value":"0zNT81Fet/du21Vmi4S2Jp/fbxqWjfSNv/l725DBDqw=","salt":"Sr5q/HaieIp5ZjVCBe8/jA==","additionalParameters":{}}',
  },
  {
    email: "nelimi3949@fuasha.com",
    secret_data:
      '{"value":"0JmHld0/OokIOsiT3babPqCxVRzIkQaM9u1QaUHR2Dk=","salt":"xUSJfXxYemBeDRvLEp8cPg==","additionalParameters":{}}',
  },
  {
    email: "gecahe8832@iamtile.com",
    secret_data:
      '{"value":"rvQ07ubUeZop+AaC2ReJg+9tIV+i+n/c4OJ6nnuU1T4=","salt":"LRTIFspjLpBuO7eDgR2Z6w==","additionalParameters":{}}',
  },
  {
    email: "ragafoj667@iamtile.com",
    secret_data:
      '{"value":"KuGSRD+kdrPA6kSBxLAZdeQajI43I+CR98v4wSvc2Q0=","salt":"RdhrwCbl+fTZEuSflX/0HA==","additionalParameters":{}}',
  },
  {
    email: "doseyek209@fuasha.com",
    secret_data:
      '{"value":"MH8LUGwR89p6i962klEJtLI3gyTAsuc8v6rIJuOQfEM=","salt":"S3qI1dPfyFq6rWez9ClgSA==","additionalParameters":{}}',
  },
  {
    email: "yapene1470@iamtile.com",
    secret_data:
      '{"value":"xLyDRsrbX2jPdd/cnp7SDr1KCtv+MD9H3Y1p8MPqhXI=","salt":"EHEmDRuxV+rGD+NHpB6unA==","additionalParameters":{}}',
  },
  {
    email: "kipewi9770@fuasha.com",
    secret_data:
      '{"value":"CliwmYpx4HwwibPi4Qfyw71hdZdIG6kumu58yGOow5k=","salt":"yodNJoNsiDX0F2eSDnIc9Q==","additionalParameters":{}}',
  },
  {
    email: "hifira1812@fuasha.com",
    secret_data:
      '{"value":"rZS5Q+f8X5uMlbqOS5ZZZEER/BjfBOJ4u3GcO4pfm5U=","salt":"4T5i+WpWcH0E19+KRLbzdg==","additionalParameters":{}}',
  },
  {
    email: "negige7351@fuasha.com",
    secret_data:
      '{"value":"7B7SsfmsvP1NKaqc8IpVJKlglYhVuQPB6Mpv93xlkEE=","salt":"G9tOxln28mmG8m11es6Zxw==","additionalParameters":{}}',
  },
  {
    email: "xarex71139@iamtile.com",
    secret_data:
      '{"value":"Fi/FMeHmIML5AVGBQw6M5gOW8oa0ZC7T4MATxvd+k/Y=","salt":"iRt0B2inww+jeBrvbfDTgw==","additionalParameters":{}}',
  },
  {
    email: "cakofis442@iamtile.com",
    secret_data:
      '{"value":"fWv4w0ORPmU67ULoTWxzw/UwxlHneG454BzTWhMjYjo=","salt":"7RTvoAy2/hvMlZEwf531tA==","additionalParameters":{}}',
  },
  {
    email: "kitikok907@iamtile.com",
    secret_data:
      '{"value":"95pjlU8YcJFWuQt5+ViigrWGHwz1UvMZOPGLnkRwj8w=","salt":"6h6bJl0W31fRsWyfpfkRpg==","additionalParameters":{}}',
  },
  {
    email: "voxal19142@iamtile.com",
    secret_data:
      '{"value":"tU3N8CjOIJe+6hlFlKb1ofkrF0bWho5b0qekaNeg8VE=","salt":"9u3shOid7NY2VV+FYGRpLw==","additionalParameters":{}}',
  },
  {
    email: "likana8386@fuasha.com",
    secret_data:
      '{"value":"OZ/PdMlB0pXdrH0C85VnsqJSCBRf23IVeYlejL4DyKA=","salt":"4sAv9fk6j/94i+hjjyY4Yw==","additionalParameters":{}}',
  },
  {
    email: "copiyik851@simerm.com",
    secret_data:
      '{"value":"KEdvR5GIcEyIi6Q5jkw43Of2Jis7w8ASW3R5TD/qWL8=","salt":"5T0kQXs1mlCPWzoggbzdSw==","additionalParameters":{}}',
  },
  {
    email: "wecow24325@devdigs.com",
    secret_data:
      '{"value":"BZGc4WZofI65nEl2yhWWSWp+pjsw2VHWBaZEX1HpBvc=","salt":"ndsxrRG+omMdXGhTUXDMcg==","additionalParameters":{}}',
  },
  {
    email: "anjali@onehash.ai",
    secret_data:
      '{"value":"Fj7S16YIcxtagCySHIXWjtZi+CPWMwnNTCtfxXvfGug=","salt":"dTSbCA6lzzFDrfKybevrQQ==","additionalParameters":{}}',
  },
  {
    email: "tigocin811@coursora.com",
    secret_data:
      '{"value":"okL2bnAXkk6gBz1O+fm/2p693HWZiznd+OhCh5fwVOI=","salt":"AqLIAI02DP0nbpUAD9i4sQ==","additionalParameters":{}}',
  },
  {
    email: "bawapab699@devdigs.com",
    secret_data:
      '{"value":"HQMnWbiSEbVrPbYyG+MQMW74Li7AdAEwbzxl58srrfk=","salt":"86EG+RM0syeOnjvd0NauUw==","additionalParameters":{}}',
  },
];

const affectedUsers: string[] = [];

async function main() {
  for (const { email, secret_data } of users) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { password: true },
      });

      if (!user) {
        console.warn(`User not found: ${email}`);
        continue;
      }

      if (user.password) {
        console.log(`User already has password: ${email}`);
        continue;
      }

      const parsed = JSON.parse(secret_data);

      await prisma.userPassword.create({
        data: {
          userId: user.id,
          hash: parsed.value,
          salt: parsed.salt,
        },
      });

      console.log(`Password added for: ${email}`);
      affectedUsers.push(email);
    } catch (err) {
      console.error(`Error processing ${email}:`, err);
    }
  }

  if (affectedUsers.length > 0) {
    const filePath = path.join(process.cwd(), "affected_users.txt");
    await fs.writeFile(filePath, affectedUsers.join("\n"), "utf8");
    console.log(`\nAffected users written to ${filePath}`);
  } else {
    console.log("No users were updated.");
  }

  await prisma.$disconnect();
}

main();
