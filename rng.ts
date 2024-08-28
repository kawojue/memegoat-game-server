import { axios } from "axios";
import { cvToValue, ClarityValue } from "@stacks/transactions";

type apiResponse = {
  ok: boolean,
  result: string,
}

let data = JSON.stringify({
  "sender": "SP2F4QC563WN0A0949WPH5W1YXVC4M1R46QKE0G14",
  "arguments": []
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://api.hiro.so/v2/contracts/call-read/SP2F4QC563WN0A0949WPH5W1YXVC4M1R46QKE0G14/memegoat-lottery-rng/get-final-number',
  headers: { 
    'Accept-Encoding': 'gzip, deflate, br, zstd', 
    'Content-Type': 'application/json'
  },
  data : data
};

axios.request(config)
.then((response) => {
  const result = (response.data as apiResponse).result;
  const number = cvToValue(result as ClarityValue).value;
  console.log(number);
})
.catch((error) => {
  console.log(error);
});
